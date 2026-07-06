import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { LineItemDto } from "../../common/dto/line-item.dto";

export class ConfirmInvoiceDraftDto {
  @IsString()
  jobId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems!: LineItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
