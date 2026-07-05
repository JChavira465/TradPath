import { IsOptional, IsString, MaxLength } from "class-validator";

export class SendMessageDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  jobId?: string;

  @IsString()
  @MaxLength(1600)
  body!: string;
}
