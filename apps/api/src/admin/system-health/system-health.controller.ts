import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { SystemHealthService } from "./system-health.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("admin/system-health")
export class SystemHealthController {
  constructor(private readonly systemHealth: SystemHealthService) {}

  @Get()
  summary() {
    return this.systemHealth.summary();
  }

  @Post("queues/:queueName/retry-failed")
  retryFailed(@Param("queueName") queueName: string) {
    return this.systemHealth.retryFailedJobs(queueName);
  }
}
