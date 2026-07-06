import { UserRole } from "@tradpath/database";
import { IsEmail, IsEnum, IsOptional } from "class-validator";

export class InviteTeamMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
