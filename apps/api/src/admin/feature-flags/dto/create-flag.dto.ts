import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

const PLANS = ["STARTER", "GROWTH", "PRO"];

export class CreateFlagDto {
  @IsString()
  key!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  defaultEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(PLANS, { each: true })
  enabledForPlans?: string[];
}
