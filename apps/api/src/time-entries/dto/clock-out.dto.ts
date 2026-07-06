import { IsLatitude, IsLongitude } from "class-validator";

export class ClockOutDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}
