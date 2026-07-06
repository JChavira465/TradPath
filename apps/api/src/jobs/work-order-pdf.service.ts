import { Injectable, Logger } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

export interface WorkOrderPdfInput {
  jobId: string;
  orgId: string;
}

@Injectable()
export class WorkOrderPdfService {
  private readonly logger = new Logger(WorkOrderPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Downloads the actual bytes for a photo/signature (public URL or private
  // storage path) so pdfkit can embed them — a PDF viewer can't follow a
  // signed URL that expires long after the document is generated.
  private async fetchImageBytes(urlOrPath: string, isPrivate: boolean): Promise<Buffer | null> {
    try {
      if (isPrivate) {
        return await this.storage.downloadPrivate(urlOrPath);
      }
      const res = await fetch(urlOrPath);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch (err: any) {
      this.logger.warn({ event: "work_order_pdf.image_fetch_failed", message: err.message });
      return null;
    }
  }

  async generate(input: WorkOrderPdfInput): Promise<Buffer> {
    const job = await this.prisma.job.findFirstOrThrow({
      where: { id: input.jobId, organizationId: input.orgId },
      include: { customer: true, organization: true, photos: true },
    });

    const [equipment, invoice] = await Promise.all([
      this.prisma.customerEquipment.findMany({ where: { customerId: job.customerId } }),
      this.prisma.invoice.findFirst({ where: { jobId: job.id }, orderBy: { createdAt: "desc" } }),
    ]);

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    doc.fontSize(20).text(job.organization.name, { continued: false });
    doc.fontSize(10).fillColor("#666").text("Work Order / Completion Report");
    doc.moveDown();

    doc.fillColor("#000").fontSize(14).text(`Job #${job.jobNumber} — ${job.title}`);
    doc.fontSize(10).fillColor("#666");
    if (job.serviceAddress) doc.text(`${job.serviceAddress}, ${job.city ?? ""} ${job.state ?? ""} ${job.zip ?? ""}`.trim());
    if (job.latitude != null && job.longitude != null) {
      doc.text(`GPS: ${job.latitude.toFixed(5)}, ${job.longitude.toFixed(5)}`);
    }
    doc.text(`Completed: ${job.actualEnd ? job.actualEnd.toLocaleString() : new Date().toLocaleString()}`);
    doc.moveDown();

    doc.fillColor("#000").fontSize(12).text("Customer");
    doc.fontSize(10).fillColor("#666");
    doc.text(`${job.customer.firstName} ${job.customer.lastName}`);
    if (job.customer.phone) doc.text(job.customer.phone);
    if (job.customer.email) doc.text(job.customer.email);
    doc.moveDown();

    if (equipment.length > 0) {
      doc.fillColor("#000").fontSize(12).text("Equipment on Site");
      doc.fontSize(10).fillColor("#666");
      for (const eq of equipment) {
        doc.text(`${eq.name}${eq.make ? ` — ${eq.make}` : ""}${eq.model ? ` ${eq.model}` : ""}`);
      }
      doc.moveDown();
    }

    if (job.completionNotes) {
      doc.fillColor("#000").fontSize(12).text("Notes");
      doc.fontSize(10).fillColor("#666").text(job.completionNotes);
      doc.moveDown();
    }

    if (invoice) {
      doc.fillColor("#000").fontSize(12).text("Parts & Labor");
      doc.fontSize(10).fillColor("#666");
      const lineItems = invoice.lineItems as any as { description: string; quantity: number; unitPrice: number }[];
      for (const li of lineItems) {
        doc.text(`${li.description} — ${li.quantity} x $${li.unitPrice.toFixed(2)} = $${(li.quantity * li.unitPrice).toFixed(2)}`);
      }
      doc.moveDown();
      doc.fillColor("#000").fontSize(11).text(`Total: $${Number(invoice.total).toFixed(2)}`);
      doc.fontSize(10).fillColor("#666").text(`Payment status: ${invoice.status}`);
      doc.moveDown();
    } else {
      doc.fillColor("#666").fontSize(10).text("Payment status: Not invoiced");
      doc.moveDown();
    }

    const galleryPhotos = job.photos.filter((p) => p.type === "BEFORE" || p.type === "AFTER" || p.type === "DURING");
    if (galleryPhotos.length > 0) {
      doc.fillColor("#000").fontSize(12).text("Photos");
      doc.moveDown(0.5);
      for (const photo of galleryPhotos) {
        const bytes = await this.fetchImageBytes(photo.url, false);
        if (!bytes) continue;
        if (doc.y > 620) doc.addPage();
        try {
          doc.image(bytes, { fit: [200, 150] });
        } catch {
          continue;
        }
        doc.fontSize(9).fillColor("#666").text(
          `${photo.type}${photo.takenAt ? ` — ${photo.takenAt.toLocaleString()}` : ""}${
            photo.latitude != null && photo.longitude != null ? ` @ ${photo.latitude.toFixed(4)},${photo.longitude.toFixed(4)}` : ""
          }`,
        );
        doc.moveDown();
      }
    }

    const signatures = job.photos.filter((p) => p.type === "SIGNATURE");
    if (signatures.length > 0) {
      doc.addPage();
      doc.fillColor("#000").fontSize(12).text("Signatures");
      doc.moveDown(0.5);
      for (const sig of signatures) {
        const bytes = await this.fetchImageBytes(sig.url, true);
        if (!bytes) continue;
        doc.fontSize(9).fillColor("#666").text(sig.caption === "TECHNICIAN" ? "Technician" : "Customer");
        try {
          doc.image(bytes, { fit: [250, 100] });
        } catch {
          continue;
        }
        doc.moveDown();
      }
    }

    doc.end();
    return done;
  }
}
