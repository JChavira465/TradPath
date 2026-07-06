import { UserRole } from "@tradpath/database";
import { IsEnum } from "class-validator";

export class UpdateRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
