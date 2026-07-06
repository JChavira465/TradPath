import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../auth/types/authenticated-user.type";
import { BillingService } from "./billing.service";
import { CreateRefundDto } from "./dto/create-refund.dto";
import { CreateCouponDto } from "./dto/create-coupon.dto";

function actorMeta(admin: AuthenticatedUser, req: FastifyRequest) {
  return { actorUserId: admin.userId, ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("admin/billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("subscriptions")
  subscriptions(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.billing.subscriptions(Number(page) || 1, Number(pageSize) || 25);
  }

  @Get("plan-mrr")
  planMrr() {
    return this.billing.planMrrBreakdown();
  }

  @Get("trials")
  trials(@Query("days") days?: string) {
    return this.billing.trialsEndingSoon(Number(days) || 7);
  }

  @Get("failed-payments")
  failedPayments(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.billing.failedPayments(Number(page) || 1, Number(pageSize) || 25);
  }

  @Post("refunds")
  createRefund(@Body() dto: CreateRefundDto, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.billing.createRefund(dto, actorMeta(admin, req));
  }

  @Get("coupons")
  listCoupons() {
    return this.billing.listCoupons();
  }

  @Post("coupons")
  createCoupon(@Body() dto: CreateCouponDto, @CurrentUser() admin: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.billing.createCoupon(dto, actorMeta(admin, req));
  }
}
