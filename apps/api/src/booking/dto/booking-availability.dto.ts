import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

export class CreateBookingAvailabilityDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "startTime must be HH:mm" })
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "endTime must be HH:mm" })
  endTime!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
