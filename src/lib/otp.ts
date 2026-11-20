import { createHash, randomInt } from "crypto";
import { positiveInt, secretKey } from "@/lib/config";

export function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

export function hashOtp(phone: string, code: string) {
  return createHash("sha256")
    .update(secretKey("OTP_SECRET"))
    .update(`:${phone}:${code}`)
    .digest("hex");
}

export function getOtpExpiryMinutes() {
  return positiveInt(process.env.OTP_EXPIRES_MINUTES, 2, 15);
}
export function getOtpResendCooldownSeconds() {
  return positiveInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60, 3600);
}
