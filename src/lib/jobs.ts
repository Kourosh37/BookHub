import { addJob, QUEUE_NAMES } from "@/lib/queue";
import { getRedis } from "@/lib/redis";
import { getQueue } from "@/lib/queue";

type OtpSmsJob = {
  phone: string;
  code: string;
};

type NotificationSmsJob = {
  to: string;
  text: string;
};

type ReminderJob = {
  bookingId: string;
  sendAtIso: string;
  audience: "host" | "guest" | "both";
};

export async function enqueueOtpSms(input: OtpSmsJob) {
  return addJob(QUEUE_NAMES.sms, "otp-sms", input, {
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

export async function enqueueNotificationSms(input: NotificationSmsJob) {
  return addJob(QUEUE_NAMES.sms, "notification-sms", input, {
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

export async function enqueueReminder(input: ReminderJob) {
  const delay = Math.max(0, new Date(input.sendAtIso).getTime() - Date.now());
  const job = await addJob(QUEUE_NAMES.reminder, "booking-reminder", input, {
    delay,
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
  const redis = getRedis();
  if (redis) {
    await redis.set(`reminder:booking:${input.bookingId}`, job.id, "EX", 60 * 60 * 24 * 14);
  }
  return job;
}

export async function cancelReminderByBookingId(bookingId: string) {
  const redis = getRedis();
  if (!redis) return;
  const key = `reminder:booking:${bookingId}`;
  const jobId = await redis.get(key);
  if (!jobId) return;

  const queue = getQueue(QUEUE_NAMES.reminder);
  const job = await queue.getJob(jobId);
  if (job) await job.remove();
  await redis.del(key);
}
