import { IsLatitude, IsLongitude } from "class-validator";

export class OnMyWayDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}
