import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrg } from "../common/decorators/current-org.decorator";
import { UsersService } from "./users.service";

@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentOrg() orgId: string) {
    return this.users.list(orgId);
  }
}
