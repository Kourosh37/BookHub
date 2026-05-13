import { createHash, randomInt } from "crypto";

const otpSecret = process.env.OTP_SECRET || process.env.NEXTAUTH_SECRET || "dev_otp_secret";

export function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

export function hashOtp(phone: string, code: string) {
  return createHash("sha256").update(`${otpSecret}:${phone}:${code}`).digest("hex");
}

export function getOtpExpiryMinutes() {
  const raw = Number(process.env.OTP_EXPIRES_MINUTES || "2");
  if (Number.isNaN(raw) || raw < 1) return 2;
  return raw;
}

export function getOtpResendCooldownSeconds() {
  const raw = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || "60");
  if (Number.isNaN(raw) || raw < 1) return 60;
  return raw;
}
