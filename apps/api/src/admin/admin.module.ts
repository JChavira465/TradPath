import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AdminAuthController } from "./auth/admin-auth.controller";
import { AdminAuthService } from "./auth/admin-auth.service";
import { ImpersonationController } from "./impersonation/impersonation.controller";
import { ImpersonationSessionController } from "./impersonation/impersonation-session.controller";
import { AuthModule } from "../auth/auth.module";
import { ExecutiveDashboardModule } from "./executive-dashboard/executive-dashboard.module";
import { CompaniesModule } from "./companies/companies.module";
import { AdminUsersModule } from "./users/admin-users.module";
import { BillingModule } from "./billing/billing.module";
import { FeatureFlagsModule } from "./feature-flags/feature-flags.module";
import { AuditLogsModule } from "./audit-logs/audit-logs.module";
import { SystemHealthModule } from "./system-health/system-health.module";
import { SupportTicketsModule } from "./support/support-tickets.module";
import { AnnouncementsModule } from "./announcements/announcements.module";
import { PlatformReportsModule } from "./platform-reports/platform-reports.module";

@Module({
  imports: [
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>("JWT_SECRET") }),
    }),
    ExecutiveDashboardModule,
    CompaniesModule,
    AdminUsersModule,
    BillingModule,
    FeatureFlagsModule,
    AuditLogsModule,
    SystemHealthModule,
    SupportTicketsModule,
    AnnouncementsModule,
    PlatformReportsModule,
  ],
  controllers: [AdminAuthController, ImpersonationController, ImpersonationSessionController],
  providers: [AdminAuthService],
})
export class AdminModule {}
