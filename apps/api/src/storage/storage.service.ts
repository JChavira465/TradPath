import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// file-type is ESM-only from v17+, which is also where a known DoS
// (infinite loop on malformed ASF/zip-bomb input) got patched — every
// CJS-compatible version (<=16.x) predates that fix. Loading it via a
// dynamic import() from this CommonJS file lets us use the patched
// version anyway; `require()` can't load an ESM-only package at all.
// TS can't resolve file-type's ESM-only `exports` map under the classic
// "node" moduleResolution this CommonJS project uses, so the shape is
// declared locally instead of relying on `typeof import("file-type")`.
interface FileTypeModule {
  fileTypeFromBuffer(input: Uint8Array | ArrayBuffer): Promise<{ ext: string; mime: string } | undefined>;
}
// Specifier kept in a variable (not a string literal) so TypeScript can't
// statically resolve it and attempt to type-check against file-type's
// unresolvable ESM `exports` map — it just falls back to `any`.
const FILE_TYPE_SPECIFIER = "file-type";
let fileTypeModulePromise: Promise<FileTypeModule> | undefined;
function loadFileType(): Promise<FileTypeModule> {
  if (!fileTypeModulePromise) {
    fileTypeModulePromise = import(FILE_TYPE_SPECIFIER);
  }
  return fileTypeModulePromise;
}

const LIMITS = {
  photo: 10 * 1024 * 1024,
  voiceMemo: 25 * 1024 * 1024,
  pdf: 15 * 1024 * 1024,
} as const;

const ALLOWED_MIME = {
  photo: new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
  voiceMemo: new Set(["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/webm", "audio/aac"]),
  pdf: new Set(["application/pdf"]),
} as const;

type UploadKind = keyof typeof LIMITS;

export interface UploadResult {
  path: string;
  publicUrl?: string;
}

@Injectable()
export class StorageService {
  private readonly client: SupabaseClient;
  private readonly publicBucket: string;
  private readonly privateBucket: string;

  constructor(private readonly config: ConfigService) {
    this.client = createClient(
      this.config.get<string>("SUPABASE_URL")!,
      this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    this.publicBucket = this.config.get<string>("SUPABASE_STORAGE_BUCKET_PUBLIC") ?? "tradpath-uploads";
    this.privateBucket = this.config.get<string>("SUPABASE_STORAGE_BUCKET_PRIVATE") ?? "tradpath-uploads-private";
  }

  // S9 — validate by MAGIC BYTES, never by extension or client-supplied MIME type.
  private async assertValidFile(buffer: Buffer, kind: UploadKind) {
    if (buffer.byteLength > LIMITS[kind]) {
      throw new BadRequestException(`File exceeds the ${LIMITS[kind] / (1024 * 1024)}MB limit for ${kind}`);
    }

    const { fileTypeFromBuffer } = await loadFileType();
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !ALLOWED_MIME[kind].has(detected.mime)) {
      throw new BadRequestException("File content does not match an allowed type for this upload");
    }
    return detected;
  }

  private buildPath(orgId: string, folder: string, ext: string) {
    return `${orgId}/${folder}/${randomUUID()}.${ext}`;
  }

  // Job photos: public bucket, no PII beyond what's on the photo itself.
  async uploadPhoto(orgId: string, buffer: Buffer): Promise<UploadResult> {
    const detected = await this.assertValidFile(buffer, "photo");
    const path = this.buildPath(orgId, "photos", detected.ext);

    const { error } = await this.client.storage
      .from(this.publicBucket)
      .upload(path, buffer, { contentType: detected.mime, upsert: false });
    if (error) throw new BadRequestException(`Upload failed: ${error.message}`);

    const { data } = this.client.storage.from(this.publicBucket).getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  }

  // Signature captures contain customer PII (a legal signature tied to a
  // job/address) — private bucket, signed URL only, never a public link.
  async uploadSignature(orgId: string, buffer: Buffer): Promise<UploadResult> {
    const detected = await this.assertValidFile(buffer, "photo");
    const path = this.buildPath(orgId, "signatures", detected.ext);

    const { error } = await this.client.storage
      .from(this.privateBucket)
      .upload(path, buffer, { contentType: detected.mime, upsert: false });
    if (error) throw new BadRequestException(`Upload failed: ${error.message}`);

    return { path };
  }

  async uploadVoiceMemo(orgId: string, buffer: Buffer): Promise<UploadResult> {
    const detected = await this.assertValidFile(buffer, "voiceMemo");
    const path = this.buildPath(orgId, "voice-memos", detected.ext);

    const { error } = await this.client.storage
      .from(this.privateBucket)
      .upload(path, buffer, { contentType: detected.mime, upsert: false });
    if (error) throw new BadRequestException(`Upload failed: ${error.message}`);

    return { path };
  }

  // Work-order PDFs and signatures contain customer PII — private bucket only.
  async uploadPDF(orgId: string, buffer: Buffer, folder = "documents"): Promise<UploadResult> {
    const detected = await this.assertValidFile(buffer, "pdf");
    const path = this.buildPath(orgId, folder, detected.ext);

    const { error } = await this.client.storage
      .from(this.privateBucket)
      .upload(path, buffer, { contentType: detected.mime, upsert: false });
    if (error) throw new BadRequestException(`Upload failed: ${error.message}`);

    return { path };
  }

  // 1-hour signed URLs for anything in the private bucket.
  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.privateBucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data) throw new BadRequestException(`Could not sign URL: ${error?.message}`);
    return data.signedUrl;
  }

  // Raw bytes for a private-bucket file — used when the content needs to be
  // embedded elsewhere (e.g. a signature stitched into a generated PDF)
  // rather than linked to via a signed URL.
  async downloadPrivate(path: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.privateBucket).download(path);
    if (error || !data) throw new BadRequestException(`Could not download file: ${error?.message}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async deleteFile(path: string, bucket: "public" | "private" = "private"): Promise<void> {
    const target = bucket === "public" ? this.publicBucket : this.privateBucket;
    const { error } = await this.client.storage.from(target).remove([path]);
    if (error) throw new BadRequestException(`Delete failed: ${error.message}`);
  }
}
