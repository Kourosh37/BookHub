import { Queue } from "bullmq";
import { prisma } from "@/lib/prisma";

export function queueConnection() {
  const raw = process.env.REDIS_URL;
  if (!raw) throw new Error("REDIS_URL is required for the worker");
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number(url.pathname.slice(1) || 0),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}
export function createNotificationQueue() {
  return new Queue("bookhub-notifications", {
    connection: queueConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 7 * 86400, count: 10000 },
      removeOnFail: { age: 30 * 86400 },
    },
  });
}
export async function publishOutbox(
  queue: ReturnType<typeof createNotificationQueue>,
) {
  const jobs = await prisma.notificationJob.findMany({
    where: {
      sentAt: null,
      canceledAt: null,
      attempts: { lt: 5 },
      OR: [
        { publishedAt: null },
        { publishedAt: { lt: new Date(Date.now() - 300000) } },
      ],
    },
    orderBy: { runAt: "asc" },
    take: 100,
  });
  for (const job of jobs) {
    await queue.add(
      "send",
      { id: job.id },
      { jobId: job.id, delay: Math.max(0, job.runAt.getTime() - Date.now()) },
    );
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: { publishedAt: new Date() },
    });
  }
}
