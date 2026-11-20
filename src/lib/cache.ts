import { getReadyRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";

async function bestEffort<T>(
  operation: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.warn({ error: String(error) }, "cache unavailable");
    return fallback;
  }
}
const connection = getReadyRedis;

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  return bestEffort(async () => {
    const raw = await (await connection())?.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }, null);
}
export async function cacheSetJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
) {
  await bestEffort(async () => {
    await (
      await connection()
    )?.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }, undefined);
}
export async function cacheDel(key: string) {
  await bestEffort(async () => {
    await (await connection())?.del(key);
  }, undefined);
}
export async function cacheDelByPattern(pattern: string) {
  await bestEffort(async () => {
    const redis = await connection();
    if (!redis) return;
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      if (keys.length) await redis.del(...keys);
      cursor = next;
    } while (cursor !== "0");
  }, undefined);
}
export async function cacheSetCooldown(key: string, ttlSeconds: number) {
  await cacheSetJson(key, 1, ttlSeconds);
}
export async function cacheGetCooldownRemaining(key: string) {
  return bestEffort(async () => {
    const ttl = await (await connection())?.ttl(key);
    return ttl && ttl > 0 ? ttl : null;
  }, null);
}
