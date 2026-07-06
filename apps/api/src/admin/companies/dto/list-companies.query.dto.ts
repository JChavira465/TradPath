import { IsIn, IsOptional, IsString } from "class-validator";

export class ListCompaniesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["STARTER", "GROWTH", "PRO"])
  plan?: string;

  @IsOptional()
  @IsIn(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "SUSPENDED"])
  status?: string;

  @IsOptional()
  @IsIn(["active", "suspended", "archived", "deleted"])
  lifecycle?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}
