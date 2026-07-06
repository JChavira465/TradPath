import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("email")
export class UnsubscribeController {
  constructor(private readonly prisma: PrismaService) {}

  // Public, unauthenticated — standard for marketing-email unsubscribe
  // links (CAN-SPAM doesn't require these to be authenticated, and the
  // worst case of a spoofed link is opting a stranger OUT of email, not a
  // security exposure).
  @Get("unsubscribe")
  async unsubscribe(@Query("email") email?: string) {
    if (!email) {
      return { success: false, message: "Missing email" };
    }
    await this.prisma.emailSuppression.upsert({
      where: { email },
      create: { email, reason: "unsubscribe_link" },
      update: {},
    });
    return { success: true };
  }
}
