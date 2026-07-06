import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { MfaVerifyDto } from "./dto/mfa-verify.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import { PushTokenDto } from "./dto/push-token.dto";
import { MobileRefreshDto } from "./dto/mobile-refresh.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "./types/authenticated-user.type";
import { clearRefreshCookie, readSignedCookie, setRefreshCookie } from "../common/utils/cookie.util";
import { RefreshMeta } from "./token.service";

// Mobile (Expo) has no cookie jar for httpOnly cookies, so it identifies
// itself with this header and exchanges refresh tokens via the response/
// request body instead, storing them in expo-secure-store (S2).
function isMobileClient(req: FastifyRequest): boolean {
  return req.headers["x-client-platform"] === "mobile";
}

function requestMeta(req: FastifyRequest): RefreshMeta {
  return {
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    platform: isMobileClient(req) ? "MOBILE" : "WEB",
  };
}

@Controller("auth")
export class AuthController {
  private readonly cookieName: string;

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {
    this.cookieName = this.config.get<string>("REFRESH_COOKIE_NAME") ?? "refresh_token";
  }

  private issueSession(req: FastifyRequest, reply: FastifyReply, refreshToken: string) {
    if (isMobileClient(req)) {
      return { refreshToken };
    }
    setRefreshCookie(reply, this.cookieName, refreshToken);
    return {};
  }

  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.register(dto, requestMeta(req));
    return {
      accessToken: result.accessToken,
      ...this.issueSession(req, reply, result.refreshToken),
      user: { id: result.user.id, email: result.user.email, firstName: result.user.firstName, role: result.user.role },
      organization: { id: result.organization.id, name: result.organization.name, slug: result.organization.slug },
    };
  }

  @Post("accept-invite")
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.acceptInvite(dto, requestMeta(req));
    return {
      accessToken: result.accessToken,
      ...this.issueSession(req, reply, result.refreshToken),
      user: { id: result.user.id, email: result.user.email, firstName: result.user.firstName, role: result.user.role },
    };
  }

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.login(dto, requestMeta(req));
    if (result.mfaRequired) {
      return { mfaRequired: true, mfaChallengeToken: result.mfaChallengeToken };
    }
    return {
      mfaRequired: false,
      accessToken: result.accessToken,
      ...this.issueSession(req, reply, result.refreshToken),
      user: { id: result.user.id, email: result.user.email, firstName: result.user.firstName, role: result.user.role },
    };
  }

  @Post("mfa/verify")
  @HttpCode(200)
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.verifyMfa(dto.mfaChallengeToken, dto.code, requestMeta(req));
    return {
      accessToken: result.accessToken,
      ...this.issueSession(req, reply, result.refreshToken),
      user: { id: result.user.id, email: result.user.email, firstName: result.user.firstName, role: result.user.role },
    };
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Body() dto: MobileRefreshDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const rawToken = isMobileClient(req) ? dto.refreshToken : readSignedCookie(req, this.cookieName);
    if (!rawToken) {
      throw new UnauthorizedException("Missing refresh token");
    }
    const result = await this.auth.refresh(rawToken, requestMeta(req));
    return {
      accessToken: result.accessToken,
      ...this.issueSession(req, reply, result.refreshToken),
    };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(
    @Body() dto: MobileRefreshDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const rawToken = isMobileClient(req) ? dto.refreshToken : readSignedCookie(req, this.cookieName);
    await this.auth.logout(rawToken);
    if (!isMobileClient(req)) {
      clearRefreshCookie(reply, this.cookieName);
    }
    return { success: true };
  }

  @Post("forgot-password")
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    // Identical response whether or not the email exists.
    return { message: "If that email exists, a reset link has been sent." };
  }

  @Post("reset-password")
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
    return { success: true };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getProfile(user.userId);
  }

  @Post("push-token")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async pushToken(@CurrentUser() user: AuthenticatedUser, @Body() dto: PushTokenDto) {
    await this.auth.updatePushToken(user.userId, dto.token, dto.platform);
    return { success: true };
  }
}
