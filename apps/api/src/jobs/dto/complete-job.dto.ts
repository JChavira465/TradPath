import { IsOptional, IsString, MaxLength } from "class-validator";

export class CompleteJobDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  completionNotes?: string;
}
