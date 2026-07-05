import { Module } from "@nestjs/common";
import { InvoicesController } from "./invoices.controller";
import { PublicInvoicesController } from "./public-invoices.controller";
import { InvoicesService } from "./invoices.service";
import { SlugRateLimitService } from "../common/utils/slug-rate-limit.service";

@Module({
  controllers: [InvoicesController, PublicInvoicesController],
  providers: [InvoicesService, SlugRateLimitService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
