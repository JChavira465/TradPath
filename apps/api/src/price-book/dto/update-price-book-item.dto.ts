import { PartialType } from "@nestjs/mapped-types";
import { CreatePriceBookItemDto } from "./create-price-book-item.dto";

export class UpdatePriceBookItemDto extends PartialType(CreatePriceBookItemDto) {}
