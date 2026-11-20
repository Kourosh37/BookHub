import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { Worker } from "bullmq";
import {
  createNotificationQueue,
  publishOutbox,
  queueConnection,
} from "@/lib/queue";
import { processNotification } from "@/lib/notifications";
import { cleanupExpiredBookingsAndSlots } from "@/lib/cleanup";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

async function main() {
  const queue = createNotificationQueue();
  const worker = new Worker(
    "bookhub-notifications",
    (job) => processNotification(job.data.id),
    { connection: queueConnection(), concurrency: 5 },
  );
  worker.on("error", (error) =>
    logger.error({ error: error.message }, "worker error"),
  );
  worker.on("failed", (job, error) =>
    logger.error(
      { jobId: job?.id, error: error.message },
      "notification failed",
    ),
  );
  let stopping = false;
  let lastCleanup = 0;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  try {
    while (!stopping) {
      try {
        await publishOutbox(queue);
        if (Date.now() - lastCleanup > 3600000) {
          await cleanupExpiredBookingsAndSlots();
          lastCleanup = Date.now();
        }
      } catch (error) {
        logger.error({ error: String(error) }, "worker maintenance failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } finally {
    await worker.close();
    await queue.close();
    await prisma.$disconnect();
  }
}
void main().catch((error) => {
  logger.fatal({ error: String(error) }, "worker stopped");
  process.exitCode = 1;
});
