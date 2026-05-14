import { getRedis } from "@/lib/redis";

type SlidingWindowInput = {
  key: string;
  limit: number;
  windowSeconds: number;
};

export async function checkSlidingWindowLimit({ key, limit, windowSeconds }: SlidingWindowInput) {
  const redis = getRedis();
  if (!redis) {
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const member = `${now}-${Math.random().toString(36).slice(2)}`;

  await redis.zremrangebyscore(key, 0, windowStart);
  await redis.zadd(key, now, member);
  const count = await redis.zcard(key);
  await redis.expire(key, windowSeconds);

  if (count > limit) {
    const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
    const oldestScore = oldest.length === 2 ? Number(oldest[1]) : now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestScore + windowSeconds * 1000 - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSeconds: 0 };
}

