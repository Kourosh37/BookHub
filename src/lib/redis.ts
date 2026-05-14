import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var redisClient: Redis | undefined;
}

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  client.on("error", () => {
    // Keep app resilient if redis has transient network issues.
  });

  return client;
}

export function getRedis() {
  if (global.redisClient) return global.redisClient;
  const client = createRedisClient();
  if (!client) return null;
  global.redisClient = client;
  return client;
}
