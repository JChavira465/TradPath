import { Module } from "@nestjs/common";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { WorkOrderPdfService } from "./work-order-pdf.service";

@Module({
  controllers: [JobsController],
  providers: [JobsService, WorkOrderPdfService],
})
export class JobsModule {}
