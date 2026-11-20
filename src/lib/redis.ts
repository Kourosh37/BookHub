import Redis from "ioredis";
const redisGlobal = globalThis as typeof globalThis & { redisClient?: Redis };
const pending = new WeakMap<Redis, Promise<Redis>>();
export function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!redisGlobal.redisClient || redisGlobal.redisClient.status === "end") {
    const client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
      commandTimeout: 2000,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    client.on("error", () => {});
    redisGlobal.redisClient = client;
  }
  return redisGlobal.redisClient;
}
export async function getReadyRedis() {
  const client = getRedis();
  if (!client || client.status === "ready") return client;
  let promise = pending.get(client);
  if (!promise) {
    promise = (
      client.status === "wait"
        ? client.connect().then(() => client)
        : new Promise<Redis>((resolve, reject) => {
            const cleanup = () => {
              clearTimeout(timer);
              client.off("ready", ready);
              client.off("error", fail);
            };
            const ready = () => {
              cleanup();
              resolve(client);
            };
            const fail = (error: Error) => {
              cleanup();
              reject(error);
            };
            const timer = setTimeout(
              () => fail(new Error("Redis connection timed out")),
              2000,
            );
            client.once("ready", ready);
            client.once("error", fail);
          })
    ).finally(() => pending.delete(client));
    pending.set(client, promise);
  }
  return promise;
}
