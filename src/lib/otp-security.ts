import { OtpPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ATTEMPT_WINDOW_MINUTES = Number(process.env.OTP_ATTEMPT_WINDOW_MINUTES || "15");
const ATTEMPT_MAX = Number(process.env.OTP_ATTEMPT_MAX || "5");
const LOCK_MINUTES = Number(process.env.OTP_LOCK_MINUTES || "30");

function nowDate() {
  return new Date();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export async function assertOtpNotLocked(phone: string, purpose: OtpPurpose) {
  const now = nowDate();
  const attempt = await prisma.otpAttempt.findUnique({ where: { phone_purpose: { phone, purpose } } });
  if (!attempt?.lockedUntil) return { locked: false as const, retryAfterSeconds: 0 };

  if (attempt.lockedUntil <= now) {
    await prisma.otpAttempt.update({
      where: { phone_purpose: { phone, purpose } },
      data: { failedCount: 0, lockedUntil: null, windowStart: now, lastAttemptAt: now },
    });
    return { locked: false as const, retryAfterSeconds: 0 };
  }

  return {
    locked: true as const,
    retryAfterSeconds: Math.max(1, Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 1000)),
  };
}

export async function registerOtpFailure(phone: string, purpose: OtpPurpose) {
  const now = nowDate();
  const windowStartLimit = new Date(now.getTime() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);

  const current = await prisma.otpAttempt.findUnique({ where: { phone_purpose: { phone, purpose } } });

  if (!current) {
    await prisma.otpAttempt.create({
      data: {
        phone,
        purpose,
        failedCount: 1,
        windowStart: now,
        lastAttemptAt: now,
      },
    });
    return;
  }

  const shouldResetWindow = current.windowStart < windowStartLimit;
  const nextFailedCount = shouldResetWindow ? 1 : current.failedCount + 1;
  const shouldLock = nextFailedCount >= ATTEMPT_MAX;

  await prisma.otpAttempt.update({
    where: { phone_purpose: { phone, purpose } },
    data: {
      failedCount: shouldLock ? 0 : nextFailedCount,
      windowStart: shouldResetWindow ? now : current.windowStart,
      lastAttemptAt: now,
      lockedUntil: shouldLock ? addMinutes(now, LOCK_MINUTES) : current.lockedUntil,
    },
  });
}

export async function clearOtpAttemptState(phone: string, purpose: OtpPurpose) {
  await prisma.otpAttempt.upsert({
    where: { phone_purpose: { phone, purpose } },
    create: {
      phone,
      purpose,
      failedCount: 0,
      lockedUntil: null,
      windowStart: nowDate(),
      lastAttemptAt: nowDate(),
    },
    update: {
      failedCount: 0,
      lockedUntil: null,
      windowStart: nowDate(),
      lastAttemptAt: nowDate(),
    },
  });
}
