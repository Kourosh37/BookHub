import Redis from "ioredis";

const redisGlobal = globalThis as typeof globalThis & { redisClient?: Redis };

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  client.on("error", () => {});

  return client;
}

export function getRedis() {
  if (redisGlobal.redisClient) return redisGlobal.redisClient;
  const client = createRedisClient();
  if (!client) return null;
  redisGlobal.redisClient = client;
  return client;
}
