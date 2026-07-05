import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import TwilioSdk from "twilio";
import { TWILIO_CLIENT } from "./twilio.constants";
import { TwilioService } from "./twilio.service";
import { TwilioController } from "./twilio.controller";

@Global()
@Module({
  controllers: [TwilioController],
  providers: [
    {
      provide: TWILIO_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const accountSid = config.get<string>("TWILIO_ACCOUNT_SID");
        const authToken = config.get<string>("TWILIO_AUTH_TOKEN");
        if (!accountSid || !authToken) return null;
        return TwilioSdk(accountSid, authToken);
      },
    },
    TwilioService,
  ],
  exports: [TwilioService],
})
export class TwilioModule {}
