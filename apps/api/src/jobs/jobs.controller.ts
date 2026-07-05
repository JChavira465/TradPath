import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user.type";
import { JobsService } from "./jobs.service";
import { CreateJobDto } from "./dto/create-job.dto";
import { UpdateJobDto } from "./dto/update-job.dto";
import { UpdateJobStatusDto } from "./dto/update-job-status.dto";
import { ListJobsQueryDto } from "./dto/list-jobs.query.dto";
import { CalendarJobsQueryDto } from "./dto/calendar-jobs.query.dto";
import { OnMyWayDto } from "./dto/on-my-way.dto";
import { CompleteJobDto } from "./dto/complete-job.dto";

@UseGuards(JwtAuthGuard)
@Controller("jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query() query: ListJobsQueryDto) {
    return this.jobs.list(orgId, query);
  }

  @Get("today")
  today(@CurrentOrg() orgId: string) {
    return this.jobs.today(orgId);
  }

  @Get("dashboard")
  dashboard(@CurrentOrg() orgId: string) {
    return this.jobs.dashboardSummary(orgId);
  }

  @Get("calendar")
  calendar(@CurrentOrg() orgId: string, @Query() query: CalendarJobsQueryDto) {
    return this.jobs.calendar(orgId, query);
  }

  @Get("unscheduled")
  unscheduled(@CurrentOrg() orgId: string) {
    return this.jobs.unscheduled(orgId);
  }

  @Get(":id")
  findOne(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.jobs.findOne(orgId, id);
  }

  @Post()
  create(@CurrentOrg() orgId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJobDto) {
    return this.jobs.create(orgId, user.userId, dto);
  }

  @Patch(":id")
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpdateJobDto) {
    return this.jobs.update(orgId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.jobs.remove(orgId, id);
  }

  @Patch(":id/status")
  updateStatus(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpdateJobStatusDto) {
    return this.jobs.updateStatus(orgId, id, dto.status);
  }

  @Post(":id/on-my-way")
  @HttpCode(200)
  onMyWay(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: OnMyWayDto) {
    return this.jobs.onMyWay(orgId, id, dto.latitude, dto.longitude);
  }

  @Get(":id/photos")
  listPhotos(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.jobs.listPhotos(orgId, id);
  }

  @Post(":id/photos")
  async uploadPhoto(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ) {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException("No file provided");
    }
    const buffer = await file.toBuffer();
    const type = (file.fields?.type as any)?.value ?? "DURING";
    const caption = (file.fields?.caption as any)?.value;
    const latitude = (file.fields?.latitude as any)?.value;
    const longitude = (file.fields?.longitude as any)?.value;

    return this.jobs.addPhoto(orgId, id, user.userId, buffer, {
      type,
      caption,
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
    });
  }

  @Post(":id/complete")
  @HttpCode(200)
  complete(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: CompleteJobDto) {
    return this.jobs.complete(orgId, id, dto);
  }

  @Get(":id/work-order-pdf")
  workOrderPdf(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.jobs.getWorkOrderPdfUrl(orgId, id);
  }
}
