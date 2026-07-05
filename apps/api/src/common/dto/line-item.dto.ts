import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class LineItemDto {
  @IsString()
  @MaxLength(500)
  description!: string;

  @IsNumber()
  @Min(0.01)
  @Max(999)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;
}
