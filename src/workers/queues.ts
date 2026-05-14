import { createWorker, QUEUE_NAMES } from "../lib/queue";
import { sendOtpSms, sendTextSms } from "../lib/sms";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

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
    const data = job.data as { bookingId: string; audience: "host" | "guest" | "both" };
    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: {
        schedule: { select: { title: true, userId: true } },
        bookedByUser: { select: { phone: true } },
      },
    });
    if (!booking) {
      logger.warn({ jobId: job.id, bookingId: data.bookingId }, "reminder booking not found");
      return;
    }

    const host = await prisma.user.findUnique({
      where: { id: booking.schedule.userId },
      select: { phone: true },
    });

    const text = `یادآوری: کمتر از ۱۰ دقیقه تا ارائه «${booking.schedule.title || "برنامه"}» باقی مانده است.`;
    if ((data.audience === "host" || data.audience === "both") && host?.phone) {
      await sendTextSms({ to: host.phone, text });
    }
    if ((data.audience === "guest" || data.audience === "both") && booking.bookedByUser?.phone) {
      await sendTextSms({ to: booking.bookedByUser.phone, text });
    }

    logger.info({ jobId: job.id, bookingId: data.bookingId }, "reminder job processed");
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
