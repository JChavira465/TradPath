import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { MessagesService } from "./messages.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { CreateMessageTemplateDto } from "./dto/create-message-template.dto";
import { UpdateMessageTemplateDto } from "./dto/update-message-template.dto";

@UseGuards(JwtAuthGuard)
@Controller("messages")
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query("customerId") customerId?: string, @Query("jobId") jobId?: string) {
    return this.messages.list(orgId, customerId, jobId);
  }

  @Post()
  send(@CurrentOrg() orgId: string, @Body() dto: SendMessageDto) {
    return this.messages.send(orgId, dto);
  }

  @Post("provision-number")
  provisionNumber(@CurrentOrg() orgId: string) {
    return this.messages.provisionNumber(orgId);
  }

  @Get("templates")
  listTemplates(@CurrentOrg() orgId: string) {
    return this.messages.listTemplates(orgId);
  }

  @Post("templates")
  createTemplate(@CurrentOrg() orgId: string, @Body() dto: CreateMessageTemplateDto) {
    return this.messages.createTemplate(orgId, dto);
  }

  @Patch("templates/:id")
  updateTemplate(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpdateMessageTemplateDto) {
    return this.messages.updateTemplate(orgId, id, dto);
  }

  @Delete("templates/:id")
  removeTemplate(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.messages.removeTemplate(orgId, id);
  }
}
