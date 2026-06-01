import Redis from "ioredis";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowSeconds: number;
};

let redis: Redis | null = null;

function getRedisUrl() {
  return process.env.AUTH_RATE_LIMIT_REDIS_URL || process.env.REDIS_URL;
}

function getRedis() {
  const url = getRedisUrl();
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_RATE_LIMIT_REDIS_URL or REDIS_URL is required for production login rate limiting.");
    }
    return null;
  }

  redis ??= new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  return redis;
}

export async function hitRateLimit({ key, limit, windowSeconds }: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  const client = getRedis();

  if (!client) return { allowed: true, remaining: limit, resetAt: new Date(now + windowSeconds * 1000) };

  const prefixedKey = `rl:${key}`;
  const count = await client.incr(prefixedKey);

  if (count === 1) {
    await client.expire(prefixedKey, windowSeconds);
  }

  const ttl = await client.ttl(prefixedKey);
  const resetAt = new Date(now + Math.max(ttl, windowSeconds) * 1000);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

export async function clearRateLimit(key: string) {
  const client = getRedis();
  if (!client) return;
  await client.del(`rl:${key}`);
}
