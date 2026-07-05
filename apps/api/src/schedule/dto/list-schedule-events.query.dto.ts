import { IsDateString } from "class-validator";

export class ListScheduleEventsQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
