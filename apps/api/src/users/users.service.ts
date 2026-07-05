import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // S1 — org-scoped list of teammates for assignee/crew-filter dropdowns.
  async list(orgId: string) {
    return this.prisma.user.findMany({
      where: { organizationId: orgId, isSuspended: false },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: { firstName: "asc" },
    });
  }
}
