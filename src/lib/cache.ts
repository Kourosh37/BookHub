import { getRedis } from "@/lib/redis";

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number) {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheDel(key: string) {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(key);
}

export async function cacheDelByPattern(pattern: string) {
  const redis = getRedis();
  if (!redis) return;
  const stream = redis.scanStream({ match: pattern, count: 100 });
  for await (const keys of stream) {
    if (Array.isArray(keys) && keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

export async function cacheSetCooldown(key: string, ttlSeconds: number) {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(key, "1", "EX", ttlSeconds);
}

export async function cacheGetCooldownRemaining(key: string) {
  const redis = getRedis();
  if (!redis) return null;
  const ttl = await redis.ttl(key);
  if (ttl <= 0) return null;
  return ttl;
}
