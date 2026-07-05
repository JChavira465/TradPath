import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { PriceBookService } from "./price-book.service";
import { CreatePriceBookItemDto } from "./dto/create-price-book-item.dto";
import { UpdatePriceBookItemDto } from "./dto/update-price-book-item.dto";

@UseGuards(JwtAuthGuard)
@Controller("price-book")
export class PriceBookController {
  constructor(private readonly priceBook: PriceBookService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query("search") search?: string) {
    return this.priceBook.list(orgId, search);
  }

  @Post()
  create(@CurrentOrg() orgId: string, @Body() dto: CreatePriceBookItemDto) {
    return this.priceBook.create(orgId, dto);
  }

  @Patch(":id")
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpdatePriceBookItemDto) {
    return this.priceBook.update(orgId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.priceBook.remove(orgId, id);
  }

  @Post("import")
  async importCsv(@CurrentOrg() orgId: string, @Req() req: FastifyRequest) {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException("No CSV file provided");
    }
    const buffer = await file.toBuffer();
    return this.priceBook.importCsv(orgId, buffer);
  }
}
