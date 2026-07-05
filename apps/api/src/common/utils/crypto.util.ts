import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * AES-256-GCM at-rest encryption for MFA secrets (S5).
 * `keyHex` must be a 64-char hex string (32 bytes) — MFA_ENCRYPTION_KEY.
 */
export function encryptSecret(plainText: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(payload: string, keyHex: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(":");
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
