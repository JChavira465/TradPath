import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CreateEquipmentDto } from "./dto/create-equipment.dto";
import { UpdateEquipmentDto } from "./dto/update-equipment.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, search?: string) {
    return this.prisma.customer.findMany({
      where: {
        organizationId: orgId,
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  private async assertExists(orgId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, organizationId: orgId } });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }

  async findOne(orgId: string, id: string) {
    return this.assertExists(orgId, id);
  }

  async create(orgId: string, dto: CreateCustomerDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException("Provide at least an email or phone number");
    }
    return this.prisma.customer.create({ data: { ...dto, organizationId: orgId } });
  }

  async update(orgId: string, id: string, dto: UpdateCustomerDto) {
    await this.assertExists(orgId, id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(orgId: string, id: string) {
    await this.assertExists(orgId, id);
    // NOTE: Job/Invoice/Estimate/ServicePlan/Equipment all cascade-delete
    // with the customer (onDelete: Cascade in schema.prisma) — the web UI
    // must confirm this explicitly before calling delete.
    await this.prisma.customer.delete({ where: { id } });
    return { success: true };
  }

  async jobs(orgId: string, id: string) {
    await this.assertExists(orgId, id);
    return this.prisma.job.findMany({ where: { customerId: id, organizationId: orgId }, orderBy: { createdAt: "desc" } });
  }

  async invoices(orgId: string, id: string) {
    await this.assertExists(orgId, id);
    return this.prisma.invoice.findMany({ where: { customerId: id, organizationId: orgId }, orderBy: { createdAt: "desc" } });
  }

  async estimates(orgId: string, id: string) {
    await this.assertExists(orgId, id);
    return this.prisma.estimate.findMany({ where: { customerId: id, organizationId: orgId }, orderBy: { createdAt: "desc" } });
  }

  async servicePlans(orgId: string, id: string) {
    await this.assertExists(orgId, id);
    return this.prisma.servicePlan.findMany({ where: { customerId: id, organizationId: orgId }, orderBy: { createdAt: "desc" } });
  }

  async messages(orgId: string, id: string) {
    await this.assertExists(orgId, id);
    return this.prisma.jobTextMessage.findMany({
      where: { customerId: id, organizationId: orgId },
      orderBy: { createdAt: "asc" },
    });
  }

  // ── Equipment (nested under customer) ──────────────────────────────
  async listEquipment(orgId: string, customerId: string) {
    await this.assertExists(orgId, customerId);
    return this.prisma.customerEquipment.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } });
  }

  private async assertEquipmentExists(orgId: string, customerId: string, equipmentId: string) {
    await this.assertExists(orgId, customerId);
    const equipment = await this.prisma.customerEquipment.findFirst({
      where: { id: equipmentId, customerId, organizationId: orgId },
    });
    if (!equipment) {
      throw new NotFoundException("Equipment not found");
    }
    return equipment;
  }

  async addEquipment(orgId: string, customerId: string, dto: CreateEquipmentDto) {
    await this.assertExists(orgId, customerId);
    return this.prisma.customerEquipment.create({
      data: {
        ...dto,
        installDate: dto.installDate ? new Date(dto.installDate) : undefined,
        warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : undefined,
        lastServiceDate: dto.lastServiceDate ? new Date(dto.lastServiceDate) : undefined,
        nextServiceDate: dto.nextServiceDate ? new Date(dto.nextServiceDate) : undefined,
        customerId,
        organizationId: orgId,
      },
    });
  }

  async updateEquipment(orgId: string, customerId: string, equipmentId: string, dto: UpdateEquipmentDto) {
    await this.assertEquipmentExists(orgId, customerId, equipmentId);
    return this.prisma.customerEquipment.update({
      where: { id: equipmentId },
      data: {
        ...dto,
        installDate: dto.installDate ? new Date(dto.installDate) : undefined,
        warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : undefined,
        lastServiceDate: dto.lastServiceDate ? new Date(dto.lastServiceDate) : undefined,
        nextServiceDate: dto.nextServiceDate ? new Date(dto.nextServiceDate) : undefined,
      },
    });
  }

  async removeEquipment(orgId: string, customerId: string, equipmentId: string) {
    await this.assertEquipmentExists(orgId, customerId, equipmentId);
    await this.prisma.customerEquipment.delete({ where: { id: equipmentId } });
    return { success: true };
  }
}
