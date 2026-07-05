import { Body, Controller, HttpCode, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyReply, FastifyRequest } from "fastify";
import { AdminAuthService } from "./admin-auth.service";
import { LoginDto } from "../../auth/dto/login.dto";
import { MfaVerifyDto } from "../../auth/dto/mfa-verify.dto";
import { clearRefreshCookie, readSignedCookie, setRefreshCookie } from "../../common/utils/cookie.util";
import { RefreshMeta } from "../../auth/token.service";

function requestMeta(req: FastifyRequest): RefreshMeta {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"], platform: "ADMIN" };
}

@Controller("admin/auth")
export class AdminAuthController {
  private readonly cookieName: string;

  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly config: ConfigService,
  ) {
    this.cookieName = this.config.get<string>("ADMIN_REFRESH_COOKIE_NAME") ?? "admin_refresh";
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const { mfaChallengeToken } = await this.adminAuth.login(dto);
    return { mfaChallengeToken };
  }

  @Post("mfa/verify")
  @HttpCode(200)
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.adminAuth.verifyMfa(dto.mfaChallengeToken, dto.code, requestMeta(req));
    setRefreshCookie(reply, this.cookieName, result.refreshToken);
    return {
      accessToken: result.accessToken,
      user: { id: result.user.id, email: result.user.email, firstName: result.user.firstName },
    };
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const rawToken = readSignedCookie(req, this.cookieName);
    if (!rawToken) {
      throw new UnauthorizedException("Missing refresh token");
    }
    const result = await this.adminAuth.refresh(rawToken, requestMeta(req));
    setRefreshCookie(reply, this.cookieName, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const rawToken = readSignedCookie(req, this.cookieName);
    await this.adminAuth.logout(rawToken);
    clearRefreshCookie(reply, this.cookieName);
    return { success: true };
  }
}
