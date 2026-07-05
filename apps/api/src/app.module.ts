import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { ThrottlerRedisStorage } from "./redis/throttler-redis-storage.service";
import { AuditModule } from "./common/audit/audit.module";
import { StorageModule } from "./storage/storage.module";
import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { JobsModule } from "./jobs/jobs.module";
import { CustomersModule } from "./customers/customers.module";
import { EstimatesModule } from "./estimates/estimates.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { StripeModule } from "./stripe/stripe.module";
import { TurnstileModule } from "./common/turnstile/turnstile.module";
import { EmailModule } from "./email/email.module";
import { QueuesModule } from "./queues/queues.module";
import { ServicePlansModule } from "./service-plans/service-plans.module";
import { BookingModule } from "./booking/booking.module";
import { PriceBookModule } from "./price-book/price-book.module";
import { TwilioModule } from "./twilio/twilio.module";
import { MessagesModule } from "./messages/messages.module";
import { OrganizationModule } from "./organization/organization.module";
import { UsersModule } from "./users/users.module";
import { ScheduleModule } from "./schedule/schedule.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    // Env validation itself runs as an explicit synchronous check at the
    // top of main.ts, not via this module's `validate` option — see the
    // comment there for why (ConfigModule.forRoot is async, which makes
    // its `validate` hook unreliable as a boot gate).
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers['set-cookie']",
            "req.body.password",
            "req.body.newPassword",
            "req.body.code",
          ],
          remove: true,
        },
        transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
      },
    }),
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [ThrottlerRedisStorage],
      useFactory: (storage: ThrottlerRedisStorage) => ({
        throttlers: [{ ttl: 60, limit: 120 }],
        storage,
      }),
    }),
    PrismaModule,
    AuditModule,
    StorageModule,
    AuthModule,
    AdminModule,
    JobsModule,
    CustomersModule,
    StripeModule,
    TurnstileModule,
    EmailModule,
    EstimatesModule,
    InvoicesModule,
    QueuesModule,
    ServicePlansModule,
    BookingModule,
    PriceBookModule,
    TwilioModule,
    MessagesModule,
    OrganizationModule,
    UsersModule,
    ScheduleModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
