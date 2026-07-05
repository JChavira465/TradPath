import { IsBoolean } from "class-validator";

export class SetBookableDto {
  @IsBoolean()
  isBookable!: boolean;
}
