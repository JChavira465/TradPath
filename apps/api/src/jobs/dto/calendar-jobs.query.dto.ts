import { IsDateString, IsOptional, IsString } from "class-validator";

export class CalendarJobsQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;
}
