import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { prisma } from "../src/lib/prisma";
import { createNotificationQueue } from "../src/lib/queue";
async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("Usage: npm run notifications:retry -- JOB_ID");
  const row = await prisma.notificationJob.findUniqueOrThrow({ where: { id } });
  if (row.sentAt || row.canceledAt)
    throw new Error("Completed or canceled messages cannot be retried");
  const queue = createNotificationQueue();
  try {
    const job = await queue.getJob(id);
    if (job) {
      const state = await job.getState();
      if (state !== "failed")
        throw new Error("Job is already queued or active");
      await job.remove();
    }
    await prisma.notificationJob.update({
      where: { id },
      data: { attempts: 0, lastError: null, publishedAt: null },
    });
    process.stdout.write("Notification returned to the durable outbox.\n");
  } finally {
    await queue.close();
  }
}
void main()
  .catch((error) => {
    process.stderr.write(String(error) + "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
