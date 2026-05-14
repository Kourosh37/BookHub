import { addJob, QUEUE_NAMES } from "@/lib/queue";

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
  return addJob(QUEUE_NAMES.reminder, "booking-reminder", input, {
    delay,
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

