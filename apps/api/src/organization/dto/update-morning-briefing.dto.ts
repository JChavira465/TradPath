import { IsBoolean, IsIn, IsOptional, Matches } from "class-validator";

export class UpdateMorningBriefingDto {
  @IsOptional()
  @IsBoolean()
  morningBriefingEnabled?: boolean;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "morningBriefingTime must be in HH:mm 24-hour format" })
  morningBriefingTime?: string;

  @IsOptional()
  @IsIn(["SMS", "EMAIL", "PUSH"])
  morningBriefingChannel?: string;
}
