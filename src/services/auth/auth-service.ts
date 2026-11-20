import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  requestOtpSchema,
  verifyOtpSchema,
  passwordLoginSchema,
} from "@/lib/validations";
import {
  clientIp,
  guardEntityRateLimit,
  guardIpRateLimit,
} from "@/lib/anti-abuse";
import { createSession, clearSession, getSession } from "@/lib/auth";
import { normalizePhoneInput } from "@/lib/phone";
import { issueOtp, verifyOtpAndRun } from "@/lib/otp-security";
import { HttpError, parseBody } from "@/lib/errors";
import { positiveInt } from "@/lib/config";

export async function requestOtp(req: Request) {
  const data = await parseBody(req, requestOtpSchema);
  const ip = clientIp(req);
  const ipRate = await guardIpRateLimit({
    keyPrefix: "rate:otp",
    ip,
    limit: positiveInt(process.env.OTP_RATE_LIMIT_IP_MAX, 10),
    windowSeconds: positiveInt(
      process.env.OTP_RATE_LIMIT_IP_WINDOW_SECONDS,
      60,
    ),
  });
  const phoneRate = await guardEntityRateLimit({
    keyPrefix: "rate:otp",
    entity: data.phone,
    limit: positiveInt(process.env.OTP_RATE_LIMIT_PHONE_MAX, 5),
    windowSeconds: positiveInt(
      process.env.OTP_RATE_LIMIT_PHONE_WINDOW_SECONDS,
      300,
    ),
  });
  if (!ipRate.allowed || !phoneRate.allowed)
    throw new HttpError(
      429,
      "Too many requests",
      Math.max(ipRate.retryAfterSeconds, phoneRate.retryAfterSeconds),
    );
  if (data.mode === "password_reset")
    throw new HttpError(400, "Use the authenticated password reset endpoint");
  const existing = await prisma.user.findUnique({
    where: { phone: data.phone },
  });
  if (data.mode === "register") {
    if (existing) throw new HttpError(409, "Phone already registered");
    if (await prisma.user.findUnique({ where: { username: data.username! } }))
      throw new HttpError(409, "Username already registered");
  } else if (!existing) throw new HttpError(404, "User not found");
  const registration =
    data.mode === "register"
      ? {
          username: data.username!,
          passwordHash: await bcrypt.hash(data.password!, 12),
        }
      : undefined;
  return NextResponse.json(await issueOtp(data.phone, "AUTH", registration));
}
export async function verifyAuthOtp(req: Request) {
  const data = await parseBody(req, verifyOtpSchema);
  const ip = clientIp(req);
  const rate = await guardIpRateLimit({
    keyPrefix: "rate:otp-verify",
    ip,
    limit: positiveInt(process.env.OTP_VERIFY_RATE_LIMIT_IP_MAX, 30),
    windowSeconds: 60,
  });
  if (!rate.allowed)
    throw new HttpError(
      429,
      "Too many verification attempts",
      rate.retryAfterSeconds,
    );
  const user = await verifyOtpAndRun(
    data.phone,
    data.code,
    "AUTH",
    async (tx, otp) => {
      const existing = await tx.user.findUnique({
        where: { phone: data.phone },
      });
      if (existing) return existing;
      if (!otp.username || !otp.passwordHash)
        throw new HttpError(404, "Account not found");
      return tx.user.create({
        data: {
          phone: data.phone,
          username: otp.username,
          password: otp.passwordHash,
        },
      });
    },
  );
  await createSession({
    userId: user.id,
    phone: user.phone!,
    sessionVersion: user.sessionVersion,
  });
  return NextResponse.json({ ok: true, id: user.id, phone: user.phone });
}
export async function passwordLogin(req: Request) {
  const ip = clientIp(req);
  const ipRate = await guardIpRateLimit({
    keyPrefix: "rate:login-password",
    ip,
    limit: positiveInt(process.env.LOGIN_PASSWORD_RATE_LIMIT_IP_MAX, 20),
    windowSeconds: positiveInt(
      process.env.LOGIN_PASSWORD_RATE_LIMIT_IP_WINDOW_SECONDS,
      60,
    ),
  });
  if (!ipRate.allowed)
    throw new HttpError(429, "Too many requests", ipRate.retryAfterSeconds);
  const data = await parseBody(req, passwordLoginSchema);
  const entityRate = await guardEntityRateLimit({
    keyPrefix: "rate:login-password",
    entity:
      normalizePhoneInput(data.identifier) || data.identifier.toLowerCase(),
    limit: 10,
    windowSeconds: 300,
  });
  if (!entityRate.allowed)
    throw new HttpError(429, "Too many requests", entityRate.retryAfterSeconds);
  const phone = normalizePhoneInput(data.identifier);
  const user = await prisma.user.findFirst({
    where: phone
      ? { OR: [{ phone }, { username: data.identifier }] }
      : { username: data.identifier },
  });
  // Use the same work factor and response for missing accounts and bad passwords.
  const valid = await bcrypt.compare(
    data.password,
    user?.password ||
      "$2b$12$wC2EY6WQZjaQDFnkdLl9k.oJNEoWFU8VLmJQDBqHM1n5H/4RwtJqK",
  );
  if (!valid || !user?.phone) throw new HttpError(401, "Invalid credentials");
  await createSession({
    userId: user.id,
    phone: user.phone,
    sessionVersion: user.sessionVersion,
  });
  return NextResponse.json({ ok: true });
}
export async function authMe() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      phone: true,
      username: true,
      avatarUrl: true,
      smsPreferences: true,
    },
  });
  return NextResponse.json({ user });
}
export async function authLogout() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
