import { Queue, Worker, type JobsOptions, type Processor, type WorkerOptions } from "bullmq";
import type IORedis from "ioredis";
import { getRedis } from "./redis";

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

export function createWorker<TData = unknown, TResult = unknown, TName extends string = string>(
  name: string,
  processor: Processor<TData, TResult, TName>,
  opts?: Omit<WorkerOptions, "connection">,
) {
  return new Worker<TData, TResult, TName>(name, processor, { ...(opts || {}), connection: getConnection() });
}

export async function addJob<T>(queueName: string, jobName: string, data: T, opts?: JobsOptions) {
  const queue = getQueue(queueName);
  return queue.add(jobName, data, opts);
}
