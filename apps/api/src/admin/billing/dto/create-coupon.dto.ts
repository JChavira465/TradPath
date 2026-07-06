import { IsIn, IsInt, IsOptional, IsPositive, IsString } from "class-validator";

export class CreateCouponDto {
  @IsString()
  name!: string;

  @IsIn(["percent", "amount"])
  type!: "percent" | "amount";

  // For type "percent" this must be 1-100 — enforced in the service layer,
  // where `type` is available for conditional validation.
  @IsInt()
  @IsPositive()
  value!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  durationInMonths?: number;
}
