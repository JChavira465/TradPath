import { IsArray, IsIn, IsISO8601, IsOptional, IsString } from "class-validator";

const PLANS = ["STARTER", "GROWTH", "PRO"];

export class CreateAnnouncementDto {
  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsIn(["INFO", "WARNING", "MAINTENANCE", "FEATURE"])
  type?: string;

  @IsOptional()
  @IsArray()
  @IsIn(PLANS, { each: true })
  targetPlans?: string[];

  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
