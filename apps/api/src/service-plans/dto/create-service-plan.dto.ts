import { BillingCycle, ServiceFrequency } from "@tradpath/database";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateServicePlanDto {
  @IsString()
  customerId!: string;

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(BillingCycle)
  billingCycle!: BillingCycle;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsEnum(ServiceFrequency)
  serviceFrequency!: ServiceFrequency;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  serviceDescription?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  assignedUserIds?: string[];

  @IsOptional()
  @IsBoolean()
  autoGenerateJobs?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSendInvoice?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  publicName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  publicDescription?: string;
}
