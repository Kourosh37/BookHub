import { OtpPurpose, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/errors";
import { positiveInt } from "@/lib/config";
import {
  generateOtpCode,
  getOtpExpiryMinutes,
  getOtpResendCooldownSeconds,
  hashOtp,
} from "@/lib/otp";
import { sendOtpSms } from "@/lib/sms";

async function lockOtp(
  tx: Prisma.TransactionClient,
  phone: string,
  purpose: OtpPurpose,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`otp:${purpose}:${phone}`}, 0))`;
}
function lockError(until: Date | null | undefined) {
  return until && until > new Date()
    ? new HttpError(
        429,
        "OTP temporarily locked",
        Math.ceil((until.getTime() - Date.now()) / 1000),
      )
    : null;
}
export async function issueOtp(
  phone: string,
  purpose: OtpPurpose,
  registration?: { username: string; passwordHash: string },
) {
  const code = generateOtpCode();
  const otp = await prisma.$transaction(async (tx) => {
    await lockOtp(tx, phone, purpose);
    const attempt = await tx.otpAttempt.findUnique({
      where: { phone_purpose: { phone, purpose } },
    });
    const locked = lockError(attempt?.lockedUntil);
    if (locked) throw locked;
    const latest = await tx.otpCode.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: "desc" },
    });
    const remaining = latest
      ? getOtpResendCooldownSeconds() -
        Math.floor((Date.now() - latest.createdAt.getTime()) / 1000)
      : 0;
    if (remaining > 0)
      throw new HttpError(429, "Resend is not allowed yet", remaining);
    await tx.otpCode.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return tx.otpCode.create({
      data: {
        phone,
        purpose,
        codeHash: hashOtp(phone, code),
        expiresAt: new Date(Date.now() + getOtpExpiryMinutes() * 60000),
        username: registration?.username,
        passwordHash: registration?.passwordHash,
      },
    });
  });
  try {
    await sendOtpSms({ phone, code });
  } catch {
    await prisma.otpCode.deleteMany({ where: { id: otp.id } });
    throw new HttpError(502, "SMS delivery failed");
  }
  return {
    ok: true,
    expiresInSeconds: getOtpExpiryMinutes() * 60,
    resendAfterSeconds: getOtpResendCooldownSeconds(),
    sms: { sent: true },
  };
}

export async function verifyOtpAndRun<T>(
  phone: string,
  code: string,
  purpose: OtpPurpose,
  action: (
    tx: Prisma.TransactionClient,
    otp: { username: string | null; passwordHash: string | null },
  ) => Promise<T>,
): Promise<T> {
  const result = await prisma.$transaction(
    async (tx) => {
      await lockOtp(tx, phone, purpose);
      const now = new Date();
      const current = await tx.otpAttempt.findUnique({
        where: { phone_purpose: { phone, purpose } },
      });
      const locked = lockError(current?.lockedUntil);
      if (locked) return { error: locked };
      const otp = await tx.otpCode.findFirst({
        where: { phone, purpose, consumedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
      });
      if (!otp || otp.codeHash !== hashOtp(phone, code)) {
        const windowMs =
          positiveInt(process.env.OTP_ATTEMPT_WINDOW_MINUTES, 15) * 60000;
        const count =
          current && now.getTime() - current.windowStart.getTime() < windowMs
            ? current.failedCount + 1
            : 1;
        const shouldLock = count >= positiveInt(process.env.OTP_ATTEMPT_MAX, 5);
        const state = {
          failedCount: count,
          windowStart:
            current && now.getTime() - current.windowStart.getTime() < windowMs
              ? current.windowStart
              : now,
          lastAttemptAt: now,
          lockedUntil: shouldLock
            ? new Date(
                now.getTime() +
                  positiveInt(process.env.OTP_LOCK_MINUTES, 30) * 60000,
              )
            : null,
        };
        await tx.otpAttempt.upsert({
          where: { phone_purpose: { phone, purpose } },
          create: { phone, purpose, ...state },
          update: state,
        });
        return {
          error: shouldLock
            ? new HttpError(
                429,
                "OTP temporarily locked",
                positiveInt(process.env.OTP_LOCK_MINUTES, 30) * 60,
              )
            : new HttpError(401, "Invalid OTP code"),
        };
      }
      const consumed = await tx.otpCode.updateMany({
        where: { id: otp.id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1)
        return { error: new HttpError(401, "Invalid OTP code") };
      const value = await action(tx, otp);
      await tx.otpAttempt.deleteMany({ where: { phone, purpose } });
      return { value };
    },
    { maxWait: 10000, timeout: 15000 },
  );
  // A failed attempt must commit its counter before responding with an error.
  if (result.error) throw result.error;
  return result.value as T;
}
