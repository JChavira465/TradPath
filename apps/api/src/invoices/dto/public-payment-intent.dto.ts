import { IsOptional, IsString } from "class-validator";

export class PublicPaymentIntentDto {
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
