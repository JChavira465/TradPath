import { IsOptional, IsString, MaxLength } from "class-validator";

export class GenerateInvoiceDraftDto {
  @IsString()
  jobId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  transcript?: string;
}
