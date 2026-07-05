import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { AccountLockedException } from "../exceptions/account-locked.exception";

@Catch(AccountLockedException)
export class AccountLockedFilter implements ExceptionFilter {
  catch(exception: AccountLockedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    reply
      .header("Retry-After", String(exception.retryAfterSeconds))
      .status(401)
      .send({ statusCode: 401, message: "Invalid credentials" });
  }
}
