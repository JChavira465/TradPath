import { Inject, Injectable } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../../redis/redis.constants";

@Injectable()
export class SlugRateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // S8 — per-slug limiting independent of per-IP: caps total submissions
  // against a single booking slug regardless of how many distinct IPs
  // are hitting it (defends against distributed abuse of one org's page).
  async assertWithinLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
    const redisKey = `slug-rate-limit:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }
    if (count > limit) {
      throw new ThrottlerException("Too many requests for this booking page. Please try again later.");
    }
  }
}
