import { Module } from "@nestjs/common";
import { PriceBookController } from "./price-book.controller";
import { PriceBookService } from "./price-book.service";

@Module({
  controllers: [PriceBookController],
  providers: [PriceBookService],
})
export class PriceBookModule {}
