import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioService } from "../twilio/twilio.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { CreateMessageTemplateDto } from "./dto/create-message-template.dto";
import { UpdateMessageTemplateDto } from "./dto/update-message-template.dto";

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
  ) {}

  async list(orgId: string, customerId?: string, jobId?: string) {
    return this.prisma.jobTextMessage.findMany({
      where: {
        organizationId: orgId,
        ...(customerId && { customerId }),
        ...(jobId && { jobId }),
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
  }

  async send(orgId: string, dto: SendMessageDto) {
    const [organization, customer] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: orgId } }),
      this.prisma.customer.findFirst({ where: { id: dto.customerId, organizationId: orgId } }),
    ]);
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    if (!customer.phone) {
      throw new BadRequestException("Customer has no phone number on file");
    }

    let twilioSid: string | null = null;
    if (organization?.twilioPhoneNumber) {
      twilioSid = await this.twilio.sendSms(organization.twilioPhoneNumber, customer.phone, dto.body);
    }

    return this.prisma.jobTextMessage.create({
      data: {
        organizationId: orgId,
        customerId: dto.customerId,
        jobId: dto.jobId,
        direction: "OUTBOUND",
        body: dto.body,
        twilioSid: twilioSid ?? undefined,
        sentAt: twilioSid ? new Date() : undefined,
      },
    });
  }

  async provisionNumber(orgId: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (organization?.twilioPhoneNumber) {
      return { phoneNumber: organization.twilioPhoneNumber, provisioned: false };
    }
    const phoneNumber = await this.twilio.provisionNumber();
    if (!phoneNumber) {
      return { phoneNumber: null, provisioned: false };
    }
    await this.prisma.organization.update({ where: { id: orgId }, data: { twilioPhoneNumber: phoneNumber } });
    return { phoneNumber, provisioned: true };
  }

  // ── Templates ───────────────────────────────────────────────────────
  async listTemplates(orgId: string) {
    return this.prisma.messageTemplate.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } });
  }

  async createTemplate(orgId: string, dto: CreateMessageTemplateDto) {
    return this.prisma.messageTemplate.create({ data: { ...dto, organizationId: orgId } });
  }

  private async assertTemplateExists(orgId: string, id: string) {
    const template = await this.prisma.messageTemplate.findFirst({ where: { id, organizationId: orgId } });
    if (!template) {
      throw new NotFoundException("Template not found");
    }
    return template;
  }

  async updateTemplate(orgId: string, id: string, dto: UpdateMessageTemplateDto) {
    await this.assertTemplateExists(orgId, id);
    return this.prisma.messageTemplate.update({ where: { id }, data: dto });
  }

  async removeTemplate(orgId: string, id: string) {
    await this.assertTemplateExists(orgId, id);
    await this.prisma.messageTemplate.delete({ where: { id } });
    return { success: true };
  }
}
