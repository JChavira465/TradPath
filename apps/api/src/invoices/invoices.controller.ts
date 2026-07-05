import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user.type";
import { InvoicesService } from "./invoices.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";

@UseGuards(JwtAuthGuard)
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query("customerId") customerId?: string, @Query("status") status?: string) {
    return this.invoices.list(orgId, customerId, status);
  }

  @Get("ar-summary")
  arSummary(@CurrentOrg() orgId: string) {
    return this.invoices.arSummary(orgId);
  }

  @Post()
  create(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(orgId, user.userId, dto);
  }

  @Get(":id")
  findOne(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.invoices.findOne(orgId, id);
  }

  @Patch(":id")
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(orgId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.invoices.remove(orgId, id);
  }

  @Post(":id/send")
  @HttpCode(200)
  send(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.invoices.send(orgId, id);
  }

  @Post(":id/payment-intent")
  @HttpCode(200)
  createPaymentIntent(@CurrentOrg() orgId: string, @Param("id") id: string) {
    // Authenticated variant (owner recording a card payment in person, etc).
    // The public /pay page uses PublicInvoicesController instead.
    return this.invoices.createPaymentIntent(id);
  }

  @Post(":id/record-payment")
  @HttpCode(200)
  recordPayment(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.invoices.recordPayment(orgId, id, user.userId, dto);
  }
}
