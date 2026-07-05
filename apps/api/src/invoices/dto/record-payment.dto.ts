import { PaymentMethod } from "@tradpath/database";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class RecordPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
