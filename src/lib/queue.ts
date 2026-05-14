import { Queue, Worker, type JobsOptions } from "bullmq";
import type IORedis from "ioredis";
import { getRedis } from "@/lib/redis";

export const QUEUE_NAMES = {
  sms: "sms-jobs",
  reminder: "reminder-jobs",
} as const;

function getConnection(): IORedis {
  const redis = getRedis();
  if (!redis) {
    throw new Error("REDIS_URL is not configured");
  }
  return redis;
}

export function getQueue(name: string) {
  return new Queue(name, { connection: getConnection() });
}

export function createWorker<T>(
  name: string,
  processor: Parameters<typeof Worker<T>>[1],
  opts?: Omit<ConstructorParameters<typeof Worker<T>>[2], "connection">,
) {
  return new Worker<T>(name, processor, { ...(opts || {}), connection: getConnection() });
}

export async function addJob<T>(queueName: string, jobName: string, data: T, opts?: JobsOptions) {
  const queue = getQueue(queueName);
  return queue.add(jobName, data, opts);
}

