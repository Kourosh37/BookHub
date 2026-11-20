import { randomUUID } from "node:crypto";
import { getReadyRedis } from "@/lib/redis";
import { HttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const slidingWindow = `
local now, window, limit = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, 0, math.max(1, math.ceil((tonumber(oldest[2]) + window - now) / 1000))}
end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], window)
return {1, limit - count - 1, 0}
`;
export async function checkSlidingWindowLimit({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}) {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger(windowSeconds) ||
    windowSeconds < 1
  )
    throw new Error("Invalid rate limit configuration");
  try {
    const redis = await getReadyRedis();
    if (!redis) throw new HttpError(503, "Security service unavailable", 5);
    const result = (await redis.eval(
      slidingWindow,
      1,
      key,
      Date.now(),
      windowSeconds * 1000,
      limit,
      randomUUID(),
    )) as number[];
    return {
      allowed: result[0] === 1,
      remaining: result[1],
      retryAfterSeconds: result[2],
    };
  } catch (error) {
    logger.error({ error: String(error) }, "rate limiter unavailable");
    throw new HttpError(503, "Security service unavailable", 5);
  }
}
