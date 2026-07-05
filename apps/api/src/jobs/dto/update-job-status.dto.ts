import { JobStatus } from "@tradpath/database";
import { IsEnum } from "class-validator";

export class UpdateJobStatusDto {
  @IsEnum(JobStatus)
  status!: JobStatus;
}
