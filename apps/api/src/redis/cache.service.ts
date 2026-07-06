import { Inject, Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // Cache-aside: serve a hit, otherwise compute, store, and return. Redis
  // being unreachable degrades to "always compute" rather than erroring —
  // reports are read-heavy aggregates, not something worth failing a
  // request over.
  async getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (err: any) {
      this.logger.warn({ event: "cache.read_failed", key, message: err.message });
    }

    const value = await compute();

    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err: any) {
      this.logger.warn({ event: "cache.write_failed", key, message: err.message });
    }

    return value;
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err: any) {
      this.logger.warn({ event: "cache.invalidate_failed", key, message: err.message });
    }
  }
}
