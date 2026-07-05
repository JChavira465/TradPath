import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateBookingBlackoutDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
