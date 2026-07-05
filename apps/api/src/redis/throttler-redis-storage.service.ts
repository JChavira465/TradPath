import { Inject, Injectable } from "@nestjs/common";
import { ThrottlerStorage } from "@nestjs/throttler";
import { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";

/**
 * Backs @nestjs/throttler with Upstash Redis so rate limits hold
 * across multiple API instances instead of resetting per-process.
 */
@Injectable()
export class ThrottlerRedisStorage implements ThrottlerStorage {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle-block:${throttlerName}:${key}`;

    const blockedTtlMs = await this.redis.pttl(blockKey);
    if (blockedTtlMs > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockedTtlMs / 1000),
      };
    }

    const totalHits = await this.redis.incr(hitKey);
    if (totalHits === 1) {
      await this.redis.pexpire(hitKey, ttl * 1000);
    }
    const ttlMs = await this.redis.pttl(hitKey);

    let isBlocked = false;
    let timeToBlockExpire = 0;
    if (totalHits > limit && blockDuration > 0) {
      isBlocked = true;
      timeToBlockExpire = blockDuration;
      await this.redis.set(blockKey, "1", "EX", blockDuration);
    }

    return {
      totalHits,
      timeToExpire: Math.max(0, Math.ceil(ttlMs / 1000)),
      isBlocked,
      timeToBlockExpire,
    };
  }
}
