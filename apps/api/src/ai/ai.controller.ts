import { BadRequestException, Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user.type";
import { AiService } from "./ai.service";
import { GenerateInvoiceDraftDto } from "./dto/generate-invoice-draft.dto";
import { ConfirmInvoiceDraftDto } from "./dto/confirm-invoice-draft.dto";

@UseGuards(JwtAuthGuard)
@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("transcribe")
  async transcribe(@CurrentOrg() orgId: string, @Req() req: FastifyRequest) {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException("No audio file provided");
    }
    const jobId = (file.fields?.jobId as any)?.value;
    if (!jobId) {
      throw new BadRequestException("jobId is required");
    }
    const buffer = await file.toBuffer();
    return this.ai.transcribe(orgId, jobId, buffer, file.filename);
  }

  @Post("generate-invoice-draft")
  generateInvoiceDraft(@CurrentOrg() orgId: string, @Body() dto: GenerateInvoiceDraftDto) {
    return this.ai.generateInvoiceDraft(orgId, dto);
  }

  @Post("confirm-invoice-draft")
  confirmInvoiceDraft(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmInvoiceDraftDto,
  ) {
    return this.ai.confirmInvoiceDraft(orgId, user.userId, dto);
  }
}
