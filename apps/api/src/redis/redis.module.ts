import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";
import { ThrottlerRedisStorage } from "./throttler-redis-storage.service";
import { CacheService } from "./cache.service";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("REDIS_URL")!;
        return new Redis(url, {
          maxRetriesPerRequest: 3,
          tls: url.startsWith("rediss://") ? {} : undefined,
        });
      },
    },
    ThrottlerRedisStorage,
    CacheService,
  ],
  exports: [REDIS_CLIENT, ThrottlerRedisStorage, CacheService],
})
export class RedisModule {}
