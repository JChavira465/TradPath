import { IsString, MaxLength, MinLength } from "class-validator";

export class AcceptInviteDto {
  @IsString()
  token!: string;

  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}
