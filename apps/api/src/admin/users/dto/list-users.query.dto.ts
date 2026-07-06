import { IsIn, IsOptional, IsString } from "class-validator";

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsIn(["OWNER", "MANAGER", "EMPLOYEE", "TECHNICIAN"])
  role?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}
