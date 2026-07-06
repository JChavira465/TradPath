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
  ],
  controllers: [AdminAuthController, ImpersonationController, ImpersonationSessionController],
  providers: [AdminAuthService],
})
export class AdminModule {}
