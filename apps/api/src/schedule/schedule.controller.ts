import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { ScheduleService } from "./schedule.service";
import { CreateScheduleEventDto } from "./dto/create-schedule-event.dto";
import { UpdateScheduleEventDto } from "./dto/update-schedule-event.dto";
import { ListScheduleEventsQueryDto } from "./dto/list-schedule-events.query.dto";

@UseGuards(JwtAuthGuard)
@Controller("schedule/events")
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query() query: ListScheduleEventsQueryDto) {
    return this.schedule.list(orgId, query.from, query.to);
  }

  @Post()
  create(@CurrentOrg() orgId: string, @Body() dto: CreateScheduleEventDto) {
    return this.schedule.create(orgId, dto);
  }

  @Patch(":id")
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpdateScheduleEventDto) {
    return this.schedule.update(orgId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.schedule.remove(orgId, id);
  }
}
