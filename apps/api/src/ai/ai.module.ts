import { Module } from "@nestjs/common";
import { InvoicesModule } from "../invoices/invoices.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

@Module({
  imports: [InvoicesModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
