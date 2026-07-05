import { Logger } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import type { Job } from "bull";
import { PrismaService } from "../prisma/prisma.service";
import { localHourIn, startOfLocalDay } from "../common/utils/timezone.util";
import { EQUIPMENT_ALERTS_QUEUE } from "./queues.constants";

const TARGET_HOUR = 8;
const NEXT_SERVICE_WINDOW_DAYS = 7;
const WARRANTY_WINDOW_DAYS = 30;

@Processor(EQUIPMENT_ALERTS_QUEUE)
export class EquipmentAlertsProcessor {
  private readonly logger = new Logger(EquipmentAlertsProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  // Warranty-expiry and next-service-due alerts. SMS/email dispatch isn't
  // wired up (matches the service-plan reminder processor) — this logs
  // intent so it can be swapped for real delivery once channels exist.
  @Process("scan")
  async scan(job: Job<{ force?: boolean }>) {
    const orgs = await this.prisma.organization.findMany({ select: { id: true, timezone: true } });
    let warrantyAlerts = 0;
    let serviceAlerts = 0;

    for (const org of orgs) {
      if (!job.data?.force && localHourIn(org.timezone) !== TARGET_HOUR) continue;

      const today = startOfLocalDay(org.timezone);
      const warrantyWindowEnd = new Date(today.getTime() + WARRANTY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const serviceWindowEnd = new Date(today.getTime() + NEXT_SERVICE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      const expiringWarranties = await this.prisma.customerEquipment.findMany({
        where: {
          organizationId: org.id,
          warrantyExpiry: { gte: today, lte: warrantyWindowEnd },
        },
        include: { customer: true },
      });

      for (const equipment of expiringWarranties) {
        this.logger.log({
          event: "equipment.warranty_expiring",
          equipmentId: equipment.id,
          customerId: equipment.customerId,
          name: equipment.name,
          warrantyExpiry: equipment.warrantyExpiry,
          channel: equipment.customer.email ? "email" : equipment.customer.phone ? "sms" : "none",
        });
        warrantyAlerts += 1;
      }

      const dueForService = await this.prisma.customerEquipment.findMany({
        where: {
          organizationId: org.id,
          nextServiceDate: { gte: today, lte: serviceWindowEnd },
        },
        include: { customer: true },
      });

      for (const equipment of dueForService) {
        this.logger.log({
          event: "equipment.service_due_soon",
          equipmentId: equipment.id,
          customerId: equipment.customerId,
          name: equipment.name,
          nextServiceDate: equipment.nextServiceDate,
          channel: equipment.customer.email ? "email" : equipment.customer.phone ? "sms" : "none",
        });
        serviceAlerts += 1;
      }
    }

    return { warrantyAlerts, serviceAlerts };
  }
}
