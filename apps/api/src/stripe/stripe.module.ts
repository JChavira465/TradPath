import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { STRIPE_CLIENT } from "./stripe.constants";
import { StripeController } from "./stripe.controller";
import { StripeWebhookService } from "./stripe-webhook.service";

@Global()
@Module({
  controllers: [StripeController],
  providers: [
    {
      provide: STRIPE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Stripe(config.get<string>("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-06-20" }),
    },
    StripeWebhookService,
  ],
  exports: [STRIPE_CLIENT],
})
export class StripeModule {}
