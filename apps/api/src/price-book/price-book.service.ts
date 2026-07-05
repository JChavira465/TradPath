import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PriceBookCategory } from "@tradpath/database";
import { PrismaService } from "../prisma/prisma.service";
import { parseCsv } from "../common/utils/csv.util";
import { CreatePriceBookItemDto } from "./dto/create-price-book-item.dto";
import { UpdatePriceBookItemDto } from "./dto/update-price-book-item.dto";

const MAX_IMPORT_ROWS = 500;
const CATEGORIES = new Set(Object.values(PriceBookCategory));

export interface ImportRowError {
  row: number;
  message: string;
}

@Injectable()
export class PriceBookService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, search?: string) {
    return this.prisma.priceBook.findMany({
      where: {
        organizationId: orgId,
        ...(search && { name: { contains: search, mode: "insensitive" } }),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  private async assertExists(orgId: string, id: string) {
    const item = await this.prisma.priceBook.findFirst({ where: { id, organizationId: orgId } });
    if (!item) {
      throw new NotFoundException("Price book item not found");
    }
    return item;
  }

  async create(orgId: string, dto: CreatePriceBookItemDto) {
    return this.prisma.priceBook.create({ data: { ...dto, organizationId: orgId } });
  }

  async update(orgId: string, id: string, dto: UpdatePriceBookItemDto) {
    await this.assertExists(orgId, id);
    return this.prisma.priceBook.update({ where: { id }, data: dto });
  }

  async remove(orgId: string, id: string) {
    await this.assertExists(orgId, id);
    await this.prisma.priceBook.delete({ where: { id } });
    return { success: true };
  }

  // Expects a header row: name,description,category,unitPrice,unit,taxable
  async importCsv(orgId: string, buffer: Buffer): Promise<{ imported: number; errors: ImportRowError[] }> {
    const rows = parseCsv(buffer.toString("utf8"));
    if (rows.length === 0) {
      throw new BadRequestException("CSV file is empty");
    }

    const [header, ...dataRows] = rows;
    const columns = header.map((h) => h.trim().toLowerCase());
    const nameIdx = columns.indexOf("name");
    const categoryIdx = columns.indexOf("category");
    const priceIdx = columns.indexOf("unitprice");
    if (nameIdx === -1 || categoryIdx === -1 || priceIdx === -1) {
      throw new BadRequestException("CSV must include name, category, and unitPrice columns");
    }
    const descriptionIdx = columns.indexOf("description");
    const unitIdx = columns.indexOf("unit");
    const taxableIdx = columns.indexOf("taxable");

    if (dataRows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`CSV has ${dataRows.length} rows, which exceeds the ${MAX_IMPORT_ROWS}-row import limit`);
    }

    const errors: ImportRowError[] = [];
    const validRows: Array<ReturnType<typeof buildRow>> = [];

    function buildRow(cols: string[]) {
      const name = cols[nameIdx]?.trim();
      const category = cols[categoryIdx]?.trim().toUpperCase();
      const priceRaw = cols[priceIdx]?.trim();
      const unitPrice = Number(priceRaw);

      return {
        name,
        description: descriptionIdx >= 0 ? cols[descriptionIdx]?.trim() || undefined : undefined,
        category,
        unitPrice,
        unit: unitIdx >= 0 ? cols[unitIdx]?.trim() || "each" : "each",
        taxable: taxableIdx >= 0 ? /^(true|yes|1)$/i.test(cols[taxableIdx]?.trim() ?? "") : true,
      };
    }

    dataRows.forEach((cols, i) => {
      const rowNumber = i + 2; // +1 for header, +1 for 1-indexing
      const parsed = buildRow(cols);

      if (!parsed.name) {
        errors.push({ row: rowNumber, message: "Missing name" });
        return;
      }
      if (!CATEGORIES.has(parsed.category as PriceBookCategory)) {
        errors.push({ row: rowNumber, message: `Invalid category "${parsed.category}" (must be LABOR, MATERIAL, or SERVICE)` });
        return;
      }
      if (!Number.isFinite(parsed.unitPrice) || parsed.unitPrice < 0) {
        errors.push({ row: rowNumber, message: `Invalid unitPrice "${cols[priceIdx]}"` });
        return;
      }
      validRows.push(parsed);
    });

    if (validRows.length > 0) {
      await this.prisma.priceBook.createMany({
        data: validRows.map((r) => ({
          organizationId: orgId,
          name: r.name!,
          description: r.description,
          category: r.category as PriceBookCategory,
          unitPrice: r.unitPrice,
          unit: r.unit,
          taxable: r.taxable,
        })),
      });
    }

    return { imported: validRows.length, errors };
  }
}
