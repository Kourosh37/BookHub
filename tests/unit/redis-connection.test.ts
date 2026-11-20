import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
const config = vi.hoisted(() => ({
  options: null as null | { retryStrategy: (times: number) => number },
}));
vi.mock("ioredis", () => ({
  default: class extends EventEmitter {
    status = "wait";
    connect = vi.fn(async () => {
      this.status = "ready";
    });
    constructor(_url: string, options: unknown) {
      super();
      config.options = options as typeof config.options;
    }
  },
}));
import { getRedis, getReadyRedis } from "@/lib/redis";
const reset = () => {
  delete (globalThis as unknown as { redisClient?: unknown }).redisClient;
};
beforeEach(reset);
afterEach(() => {
  reset();
  vi.useRealTimers();
});
it("connects lazily once and reuses a ready client", async () => {
  const client = getRedis()!;
  expect(await getReadyRedis()).toBe(client);
  expect(await getReadyRedis()).toBe(client);
  expect(client.connect).toHaveBeenCalledOnce();
  expect(config.options!.retryStrategy(50)).toBe(2000);
  expect(config.options!.retryStrategy(1)).toBe(200);
  client.emit("error", new Error("handled"));
});
it("shares one readiness wait and removes listeners after success", async () => {
  const client = getRedis()!;
  Object.assign(client, { status: "connecting" });
  const a = getReadyRedis(),
    b = getReadyRedis();
  expect(client.listenerCount("ready")).toBe(1);
  Object.assign(client, { status: "ready" });
  client.emit("ready");
  expect(await a).toBe(client);
  expect(await b).toBe(client);
  expect(client.listenerCount("ready")).toBe(0);
});
it("rejects failed connections and cleans pending listeners", async () => {
  const client = getRedis()!;
  Object.assign(client, { status: "connecting" });
  const p = getReadyRedis();
  const assertion = expect(p).rejects.toThrow("offline");
  client.emit("error", new Error("offline"));
  await assertion;
  expect(client.listenerCount("ready")).toBe(0);
});
it("bounds reconnect waits with a timeout", async () => {
  vi.useFakeTimers();
  const client = getRedis()!;
  Object.assign(client, { status: "reconnecting" });
  const assertion = expect(getReadyRedis()).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(2001);
  await assertion;
  expect(client.listenerCount("ready")).toBe(0);
});
it("handles absent Redis and replaces explicitly closed clients", async () => {
  const old = getRedis()!;
  Object.assign(old, { status: "end" });
  expect(getRedis()).not.toBe(old);
  vi.stubEnv("REDIS_URL", "");
  expect(getRedis()).toBeNull();
  expect(await getReadyRedis()).toBeNull();
});
