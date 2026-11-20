import { it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  client: null as null | Record<string, unknown>,
}));
vi.mock("@/lib/redis", () => ({
  getRedis: () => state.client,
  getReadyRedis: async () => state.client,
}));
import {
  cacheGetJson,
  cacheSetJson,
  cacheDel,
  cacheDelByPattern,
  cacheGetCooldownRemaining,
} from "@/lib/cache";
import { checkSlidingWindowLimit } from "@/lib/rate-limit";
import { queueConnection } from "@/lib/queue";
it("cache absence is optional but rate limiting fails closed", async () => {
  state.client = null;
  expect(await cacheGetJson("key")).toBeNull();
  await cacheSetJson("key", 1, 60);
  await cacheDel("key");
  await cacheDelByPattern("*");
  expect(await cacheGetCooldownRemaining("key")).toBeNull();
  await expect(
    checkSlidingWindowLimit({ key: "key", limit: 1, windowSeconds: 60 }),
  ).rejects.toMatchObject({ status: 503 });
});
it("cache failures do not take down reads or writes", async () => {
  const fail = vi.fn().mockRejectedValue(new Error("offline"));
  state.client = {
    get: fail,
    set: fail,
    del: fail,
    scan: fail,
    ttl: fail,
    eval: fail,
    status: "ready",
  };
  expect(await cacheGetJson("key")).toBeNull();
  await cacheSetJson("key", 1, 60);
  await cacheDel("key");
  await cacheDelByPattern("*");
  expect(await cacheGetCooldownRemaining("key")).toBeNull();
  await expect(
    checkSlidingWindowLimit({ key: "key", limit: 1, windowSeconds: 60 }),
  ).rejects.toMatchObject({ status: 503 });
});
it("configures separate authenticated/TLS Redis worker connections", () => {
  vi.stubEnv("REDIS_URL", "rediss://user:pass@localhost:6380/2");
  expect(queueConnection()).toMatchObject({
    host: "localhost",
    port: 6380,
    db: 2,
    username: "user",
    password: "pass",
    tls: {},
    maxRetriesPerRequest: null,
  });
  vi.stubEnv("REDIS_URL", "");
  expect(() => queueConnection()).toThrow("REDIS_URL");
});
