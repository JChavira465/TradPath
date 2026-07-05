import { PriceBookCategory } from "@tradpath/database";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min, MaxLength } from "class-validator";

export class CreatePriceBookItemDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(PriceBookCategory)
  category!: PriceBookCategory;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
