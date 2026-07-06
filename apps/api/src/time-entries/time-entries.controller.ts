import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ManagerGuard } from "../common/guards/manager.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user.type";
import { AuditService } from "../common/audit/audit.service";
import { TimeEntriesService } from "./time-entries.service";
import { ClockInDto } from "./dto/clock-in.dto";
import { ClockOutDto } from "./dto/clock-out.dto";
import { UpdateTimeEntryDto } from "./dto/update-time-entry.dto";
import { ListTimeEntriesQueryDto } from "./dto/list-time-entries.query.dto";
import { TimesheetQueryDto } from "./dto/timesheet-query.dto";

@UseGuards(JwtAuthGuard)
@Controller("time-entries")
export class TimeEntriesController {
  constructor(
    private readonly timeEntries: TimeEntriesService,
    private readonly audit: AuditService,
  ) {}

  @Get("active")
  active(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.timeEntries.getActive(orgId, user.userId);
  }

  @Post("clock-in")
  clockIn(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: ClockInDto) {
    return this.timeEntries.clockIn(orgId, user.userId, dto);
  }

  @Post("clock-out")
  clockOut(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: ClockOutDto) {
    return this.timeEntries.clockOut(orgId, user.userId, dto);
  }

  @Post("break/start")
  startBreak(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.timeEntries.startBreak(orgId, user.userId);
  }

  @Post("break/end")
  endBreak(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.timeEntries.endBreak(orgId, user.userId);
  }

  @Get("timesheet")
  timesheet(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TimesheetQueryDto,
  ) {
    return this.timeEntries.timesheet(orgId, user, query);
  }

  @Get("export.csv")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="timesheets.csv"')
  exportCsv(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTimeEntriesQueryDto,
  ) {
    return this.timeEntries.exportCsv(orgId, user, query);
  }

  @Get()
  list(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser, @Query() query: ListTimeEntriesQueryDto) {
    return this.timeEntries.list(orgId, user, query);
  }

  @UseGuards(ManagerGuard)
  @Patch(":id")
  async update(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTimeEntryDto,
    @Req() req: FastifyRequest,
  ) {
    const { updated, oldValue } = await this.timeEntries.update(orgId, id, dto);
    await this.audit.log({
      organizationId: orgId,
      userId: user.userId,
      action: "TIME_ENTRY_EDITED",
      resource: "TimeEntry",
      resourceId: id,
      oldValue,
      newValue: { clockIn: updated!.clockIn, clockOut: updated!.clockOut, breakMinutes: updated!.breakMinutes, notes: updated!.notes },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      platform: "WEB",
    });
    return updated;
  }

  @UseGuards(ManagerGuard)
  @Post(":id/approve")
  async approve(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    const result = await this.timeEntries.approve(orgId, id, user.userId);
    await this.audit.log({
      organizationId: orgId,
      userId: user.userId,
      action: "TIME_ENTRY_APPROVED",
      resource: "TimeEntry",
      resourceId: id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      platform: "WEB",
    });
    return result;
  }

  @UseGuards(ManagerGuard)
  @Post(":id/reject")
  async reject(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    const result = await this.timeEntries.reject(orgId, id, user.userId);
    await this.audit.log({
      organizationId: orgId,
      userId: user.userId,
      action: "TIME_ENTRY_REJECTED",
      resource: "TimeEntry",
      resourceId: id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      platform: "WEB",
    });
    return result;
  }

  @UseGuards(ManagerGuard)
  @Delete(":id")
  async remove(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    const removed = await this.timeEntries.remove(orgId, id);
    await this.audit.log({
      organizationId: orgId,
      userId: user.userId,
      action: "TIME_ENTRY_DELETED",
      resource: "TimeEntry",
      resourceId: id,
      oldValue: removed,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      platform: "WEB",
    });
    return { success: true };
  }
}
