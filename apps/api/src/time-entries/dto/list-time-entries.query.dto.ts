import { TimeEntryStatus } from "@tradpath/database";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";

export class ListTimeEntriesQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(TimeEntryStatus)
  status?: TimeEntryStatus;
}
