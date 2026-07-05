import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CreateEquipmentDto } from "./dto/create-equipment.dto";
import { UpdateEquipmentDto } from "./dto/update-equipment.dto";

@UseGuards(JwtAuthGuard)
@Controller("customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query("search") search?: string) {
    return this.customers.list(orgId, search);
  }

  @Post()
  create(@CurrentOrg() orgId: string, @Body() dto: CreateCustomerDto) {
    return this.customers.create(orgId, dto);
  }

  @Get(":id")
  findOne(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.customers.findOne(orgId, id);
  }

  @Patch(":id")
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(orgId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.customers.remove(orgId, id);
  }

  @Get(":id/jobs")
  jobs(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.customers.jobs(orgId, id);
  }

  @Get(":id/invoices")
  invoices(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.customers.invoices(orgId, id);
  }

  @Get(":id/estimates")
  estimates(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.customers.estimates(orgId, id);
  }

  @Get(":id/service-plans")
  servicePlans(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.customers.servicePlans(orgId, id);
  }

  @Get(":id/messages")
  messages(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.customers.messages(orgId, id);
  }

  @Get(":id/equipment")
  listEquipment(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.customers.listEquipment(orgId, id);
  }

  @Post(":id/equipment")
  addEquipment(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: CreateEquipmentDto) {
    return this.customers.addEquipment(orgId, id, dto);
  }

  @Patch(":id/equipment/:equipmentId")
  updateEquipment(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Param("equipmentId") equipmentId: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.customers.updateEquipment(orgId, id, equipmentId, dto);
  }

  @Delete(":id/equipment/:equipmentId")
  removeEquipment(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Param("equipmentId") equipmentId: string,
  ) {
    return this.customers.removeEquipment(orgId, id, equipmentId);
  }
}
