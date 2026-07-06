import { Global, Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { UnsubscribeController } from "./unsubscribe.controller";

@Global()
@Module({
  controllers: [UnsubscribeController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
