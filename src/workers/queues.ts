import { createWorker, QUEUE_NAMES } from "@/lib/queue";
import { sendOtpSms, sendTextSms } from "@/lib/sms";
import { logger } from "@/lib/logger";

async function start() {
  const smsWorker = createWorker<any>(QUEUE_NAMES.sms, async (job) => {
    if (job.name === "otp-sms") {
      await sendOtpSms(job.data as { phone: string; code: string });
      logger.info({ jobId: job.id, name: job.name }, "otp sms job processed");
      return;
    }

    if (job.name === "notification-sms") {
      await sendTextSms(job.data as { to: string; text: string });
      logger.info({ jobId: job.id, name: job.name }, "notification sms job processed");
      return;
    }
  });

  const reminderWorker = createWorker<any>(QUEUE_NAMES.reminder, async (job) => {
    logger.info({ jobId: job.id, data: job.data }, "reminder job reached schedule time");
  });

  smsWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, name: job?.name, err: err.message }, "sms worker job failed");
  });

  reminderWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, name: job?.name, err: err.message }, "reminder worker job failed");
  });

  logger.info("queue workers started");
}

start().catch((err) => {
  logger.error({ err: err?.message }, "queue workers failed to start");
  process.exit(1);
});

