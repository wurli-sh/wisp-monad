import { Redis } from "@upstash/redis";
import type { AppConfig } from "../config.ts";

export type RateLimiter = {
  check(key: string, limit: number, windowSec: number): Promise<boolean>;
};

export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  async check(key: string, limit: number, windowSec: number): Promise<boolean> {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
      return true;
    }
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  }
}

class UpstashRateLimiter implements RateLimiter {
  constructor(private redis: Redis) {}

  async check(key: string, limit: number, windowSec: number): Promise<boolean> {
    const bucketKey = `rl:${key}`;
    const count = await this.redis.eval<[number], number>(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n",
      [bucketKey],
      [windowSec],
    );
    return count <= limit;
  }
}

export function createRateLimiter(config: AppConfig): RateLimiter {
  if (config.redisUrl && config.redisToken) {
    const redis = new Redis({ url: config.redisUrl, token: config.redisToken });
    return new UpstashRateLimiter(redis);
  }
  if (config.isProduction) {
    throw new Error("REDIS_URL and REDIS_TOKEN required in production");
  }
  return new MemoryRateLimiter();
}

export async function pingRedis(config: AppConfig): Promise<boolean> {
  if (!config.redisUrl || !config.redisToken) {
    return !config.isProduction;
  }
  const redis = new Redis({ url: config.redisUrl, token: config.redisToken });
  const pong = await redis.ping();
  return pong === "PONG";
}
