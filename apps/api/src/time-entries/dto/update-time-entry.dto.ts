import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class UpdateTimeEntryDto {
  @IsOptional()
  @IsDateString()
  clockIn?: string;

  @IsOptional()
  @IsDateString()
  clockOut?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  breakMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
