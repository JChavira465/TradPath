import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class SubscribeDto {
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(30)
  phone!: string;

  @IsString()
  planTemplateId!: string;

  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
