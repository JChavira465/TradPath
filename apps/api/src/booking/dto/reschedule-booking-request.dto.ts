import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class RescheduleBookingRequestDto {
  @IsDateString()
  requestedDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  requestedTimeSlot?: string;
}
