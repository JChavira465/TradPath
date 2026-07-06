import { IsLatitude, IsLongitude, IsOptional, IsString } from "class-validator";

export class ClockInDto {
  @IsOptional()
  @IsString()
  jobId?: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}
