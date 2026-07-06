import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { startOfLocalDayFor, startOfLocalWeekFor } from "../common/utils/timezone.util";
import { AuthenticatedUser } from "../auth/types/authenticated-user.type";
import { ClockInDto } from "./dto/clock-in.dto";
import { ClockOutDto } from "./dto/clock-out.dto";
import { UpdateTimeEntryDto } from "./dto/update-time-entry.dto";
import { ListTimeEntriesQueryDto } from "./dto/list-time-entries.query.dto";
import { TimesheetQueryDto } from "./dto/timesheet-query.dto";

const DAILY_OVERTIME_THRESHOLD_HOURS = 8;
const WEEKLY_OVERTIME_THRESHOLD_HOURS = 40;

function isManager(user: AuthenticatedUser) {
  return user.role === "OWNER" || user.role === "MANAGER";
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getActive(orgId: string, userId: string) {
    return this.prisma.timeEntry.findFirst({
      where: { organizationId: orgId, userId, status: "ACTIVE" },
      include: { job: { select: { id: true, jobNumber: true, title: true } } },
    });
  }

  async clockIn(orgId: string, userId: string, dto: ClockInDto) {
    const existing = await this.getActive(orgId, userId);
    if (existing) {
      throw new BadRequestException("Already clocked in — clock out first");
    }
    if (dto.jobId) {
      const job = await this.prisma.job.findFirst({ where: { id: dto.jobId, organizationId: orgId } });
      if (!job) {
        throw new BadRequestException("Job not found in this organization");
      }
    }
    // Server sets clockIn — client-submitted timestamps are never trusted.
    return this.prisma.timeEntry.create({
      data: {
        organizationId: orgId,
        userId,
        jobId: dto.jobId,
        clockIn: new Date(),
        clockInLat: dto.latitude,
        clockInLng: dto.longitude,
        status: "ACTIVE",
      },
    });
  }

  async clockOut(orgId: string, userId: string, dto: ClockOutDto) {
    const active = await this.getActive(orgId, userId);
    if (!active) {
      throw new BadRequestException("Not currently clocked in");
    }

    let breakMinutes = active.breakMinutes;
    if (active.breakStartedAt) {
      breakMinutes += Math.round((Date.now() - active.breakStartedAt.getTime()) / 60000);
    }

    const clockOut = new Date();
    const rawHours = (clockOut.getTime() - active.clockIn.getTime()) / 3600000 - breakMinutes / 60;
    const totalHours = Math.max(0, round2(rawHours));

    await this.prisma.timeEntry.update({
      where: { id: active.id },
      data: {
        clockOut,
        clockOutLat: dto.latitude,
        clockOutLng: dto.longitude,
        breakMinutes,
        breakStartedAt: null,
        totalHours,
        status: "COMPLETED",
      },
    });

    await this.recalculateDailyOvertime(orgId, userId, active.clockIn);
    return this.prisma.timeEntry.findUnique({ where: { id: active.id } });
  }

  async startBreak(orgId: string, userId: string) {
    const active = await this.getActive(orgId, userId);
    if (!active) {
      throw new BadRequestException("Not currently clocked in");
    }
    if (active.breakStartedAt) {
      throw new BadRequestException("Break already in progress");
    }
    return this.prisma.timeEntry.update({ where: { id: active.id }, data: { breakStartedAt: new Date() } });
  }

  async endBreak(orgId: string, userId: string) {
    const active = await this.getActive(orgId, userId);
    if (!active) {
      throw new BadRequestException("Not currently clocked in");
    }
    if (!active.breakStartedAt) {
      throw new BadRequestException("No break in progress");
    }
    const minutes = Math.max(0, Math.round((Date.now() - active.breakStartedAt.getTime()) / 60000));
    return this.prisma.timeEntry.update({
      where: { id: active.id },
      data: { breakMinutes: active.breakMinutes + minutes, breakStartedAt: null },
    });
  }

  // Daily overtime (>8/day) is allocated per entry, in chronological order,
  // against a running total for that user's local calendar day — this is
  // what's persisted on TimeEntry.regularHours/overtimeHours. The weekly
  // (>40/wk) threshold is intentionally NOT re-allocated back onto
  // individual entries (a single week can span entries whose daily OT
  // already accounts for part of the excess, and double-attributing would
  // misstate per-entry pay); it's surfaced instead as a computed aggregate
  // in timesheet() below, alongside the summed daily overtime.
  private async recalculateDailyOvertime(orgId: string, userId: string, referenceDate: Date) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
    const timezone = org?.timezone ?? "America/Chicago";
    const dayStart = startOfLocalDayFor(referenceDate, timezone);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const entries = await this.prisma.timeEntry.findMany({
      where: { organizationId: orgId, userId, clockIn: { gte: dayStart, lt: dayEnd }, clockOut: { not: null } },
      orderBy: { clockIn: "asc" },
    });

    let cumulative = 0;
    for (const entry of entries) {
      const hours = Number(entry.totalHours ?? 0);
      const regular = Math.max(0, Math.min(hours, DAILY_OVERTIME_THRESHOLD_HOURS - cumulative));
      const overtime = Math.max(0, round2(hours - regular));
      cumulative += hours;
      await this.prisma.timeEntry.update({
        where: { id: entry.id },
        data: { regularHours: round2(regular), overtimeHours: overtime },
      });
    }
  }

  private async assertExists(orgId: string, id: string) {
    const entry = await this.prisma.timeEntry.findFirst({ where: { id, organizationId: orgId } });
    if (!entry) {
      throw new NotFoundException("Time entry not found");
    }
    return entry;
  }

  async list(orgId: string, actingUser: AuthenticatedUser, query: ListTimeEntriesQueryDto) {
    // Employees/technicians may only ever see their own entries, regardless
    // of what userId they pass — managers can view anyone's.
    const userId = isManager(actingUser) ? query.userId : actingUser.userId;

    return this.prisma.timeEntry.findMany({
      where: {
        organizationId: orgId,
        ...(userId && { userId }),
        ...(query.jobId && { jobId: query.jobId }),
        ...(query.status && { status: query.status }),
        ...((query.from || query.to) && {
          clockIn: {
            ...(query.from && { gte: new Date(query.from) }),
            ...(query.to && { lte: new Date(query.to) }),
          },
        }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        job: { select: { id: true, jobNumber: true, title: true } },
      },
      orderBy: { clockIn: "desc" },
      take: 500,
    });
  }

  async update(orgId: string, id: string, dto: UpdateTimeEntryDto) {
    const entry = await this.assertExists(orgId, id);
    const oldValue = {
      clockIn: entry.clockIn,
      clockOut: entry.clockOut,
      breakMinutes: entry.breakMinutes,
      notes: entry.notes,
    };

    const clockIn = dto.clockIn ? new Date(dto.clockIn) : entry.clockIn;
    const clockOut = dto.clockOut ? new Date(dto.clockOut) : entry.clockOut;
    const breakMinutes = dto.breakMinutes ?? entry.breakMinutes;

    if (clockOut && clockOut.getTime() <= clockIn.getTime()) {
      throw new BadRequestException("Clock-out must be after clock-in");
    }

    let totalHours: number | null = entry.totalHours ? Number(entry.totalHours) : null;
    if (clockOut) {
      const rawHours = (clockOut.getTime() - clockIn.getTime()) / 3600000 - breakMinutes / 60;
      totalHours = Math.max(0, round2(rawHours));
    }

    await this.prisma.timeEntry.update({
      where: { id },
      data: {
        clockIn,
        clockOut,
        breakMinutes,
        notes: dto.notes ?? entry.notes,
        totalHours,
      },
    });

    if (clockOut) {
      await this.recalculateDailyOvertime(orgId, entry.userId, clockIn);
    }

    const updated = await this.prisma.timeEntry.findUnique({ where: { id } });
    return { updated, oldValue };
  }

  async approve(orgId: string, id: string, managerId: string) {
    const entry = await this.assertExists(orgId, id);
    if (entry.status !== "COMPLETED") {
      throw new BadRequestException("Only completed entries can be approved");
    }
    return this.prisma.timeEntry.update({
      where: { id },
      data: { status: "APPROVED", approvedBy: managerId, approvedAt: new Date() },
    });
  }

  async reject(orgId: string, id: string, managerId: string) {
    const entry = await this.assertExists(orgId, id);
    if (entry.status !== "COMPLETED") {
      throw new BadRequestException("Only completed entries can be rejected");
    }
    return this.prisma.timeEntry.update({
      where: { id },
      data: { status: "REJECTED", approvedBy: managerId, approvedAt: new Date() },
    });
  }

  async remove(orgId: string, id: string) {
    const entry = await this.assertExists(orgId, id);
    await this.prisma.timeEntry.delete({ where: { id } });
    return entry;
  }

  async timesheet(orgId: string, actingUser: AuthenticatedUser, query: TimesheetQueryDto) {
    const userId = isManager(actingUser) ? query.userId : actingUser.userId;
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
    const timezone = org?.timezone ?? "America/Chicago";

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        organizationId: orgId,
        ...(userId && { userId }),
        clockIn: { gte: new Date(query.from), lte: new Date(query.to) },
        clockOut: { not: null },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { clockIn: "asc" },
    });

    const byUser = new Map<
      string,
      { userId: string; name: string; entries: typeof entries; totalHours: number; regularHours: number }
    >();

    for (const entry of entries) {
      const key = entry.userId;
      if (!byUser.has(key)) {
        byUser.set(key, {
          userId: key,
          name: `${entry.user.firstName} ${entry.user.lastName}`,
          entries: [],
          totalHours: 0,
          regularHours: 0,
        });
      }
      const bucket = byUser.get(key)!;
      bucket.entries.push(entry);
      bucket.totalHours += Number(entry.totalHours ?? 0);
      bucket.regularHours += Number(entry.regularHours ?? 0);
    }

    return Array.from(byUser.values()).map((bucket) => {
      // Weekly overtime is computed by grouping this user's entries (within
      // the requested range) into their local Sun-Sat weeks and flagging
      // hours beyond 40/week — see recalculateDailyOvertime's comment for
      // why this isn't also written back onto individual entries.
      const weeks = new Map<number, number>();
      for (const entry of bucket.entries) {
        const weekStart = startOfLocalWeekFor(entry.clockIn, timezone).getTime();
        weeks.set(weekStart, (weeks.get(weekStart) ?? 0) + Number(entry.totalHours ?? 0));
      }
      let weeklyOvertimeHours = 0;
      for (const weekTotal of weeks.values()) {
        weeklyOvertimeHours += Math.max(0, weekTotal - WEEKLY_OVERTIME_THRESHOLD_HOURS);
      }
      const dailyOvertimeHours = round2(bucket.totalHours - bucket.regularHours);

      return {
        userId: bucket.userId,
        name: bucket.name,
        totalHours: round2(bucket.totalHours),
        regularHours: round2(bucket.regularHours),
        dailyOvertimeHours,
        weeklyOvertimeHours: round2(weeklyOvertimeHours),
        overtimeHours: round2(Math.max(dailyOvertimeHours, weeklyOvertimeHours)),
        entryCount: bucket.entries.length,
      };
    });
  }

  async exportCsv(orgId: string, actingUser: AuthenticatedUser, query: ListTimeEntriesQueryDto) {
    const entries = await this.list(orgId, actingUser, query);
    const header = [
      "Employee",
      "Job",
      "Clock In",
      "Clock Out",
      "Break (min)",
      "Total Hours",
      "Regular Hours",
      "Overtime Hours",
      "Status",
    ];
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = entries.map((e: any) => [
      escape(`${e.user.firstName} ${e.user.lastName}`),
      escape(e.job ? `#${e.job.jobNumber} ${e.job.title}` : ""),
      escape(e.clockIn.toISOString()),
      escape(e.clockOut ? e.clockOut.toISOString() : ""),
      String(e.breakMinutes),
      String(e.totalHours ?? ""),
      String(e.regularHours ?? ""),
      String(e.overtimeHours ?? ""),
      escape(e.status),
    ]);
    return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }
}
