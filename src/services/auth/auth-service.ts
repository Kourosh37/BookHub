import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requestOtpSchema, verifyOtpSchema, passwordLoginSchema } from "@/lib/validations";
import { generateOtpCode, getOtpExpiryMinutes, getOtpResendCooldownSeconds, hashOtp } from "@/lib/otp";
import { cacheGetCooldownRemaining, cacheSetCooldown } from "@/lib/cache";
import { withRequestId } from "@/lib/logger";
import { sendOtpSms } from "@/lib/sms";
import { checkSlidingWindowLimit } from "@/lib/rate-limit";
import { createSession, clearSession, getSession } from "@/lib/auth";
import { normalizePhoneInput } from "@/lib/phone";

function normalizeLoginPhone(value: string) {
  return normalizePhoneInput(value);
}

export async function requestOtp(req: Request) {
  const log = withRequestId(req.headers.get("x-request-id"));
  const body = await req.json();
  const parsed = requestOtpSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "payload";
    return NextResponse.json({ error: "داده نامعتبر است", details: `${path}: ${issue?.message || "نامعتبر"}` }, { status: 400 });
  }

  const { phone, mode } = parsed.data;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipRate = await checkSlidingWindowLimit({
    key: `rate:otp:ip:${ip}`,
    limit: Number(process.env.OTP_RATE_LIMIT_IP_MAX || "10"),
    windowSeconds: Number(process.env.OTP_RATE_LIMIT_IP_WINDOW_SECONDS || "60"),
  });

  if (!ipRate.allowed) {
    return NextResponse.json(
      { error: "تعداد درخواست بیش از حد مجاز است", details: `لطفا ${ipRate.retryAfterSeconds} ثانیه دیگر تلاش کنید` },
      { status: 429 },
    );
  }

  if (mode === "register") {
    const userByPhone = await prisma.user.findFirst({ where: { phone } });
    if (userByPhone) return NextResponse.json({ error: "این شماره قبلاً ثبت شده است" }, { status: 409 });

    if (parsed.data.username) {
      const userByUsername = await prisma.user.findFirst({ where: { username: parsed.data.username } });
      if (userByUsername) return NextResponse.json({ error: "این نام کاربری قبلاً ثبت شده است" }, { status: 409 });
    }
  }

  if (mode === "login_phone") {
    const userByPhone = await prisma.user.findFirst({ where: { phone } });
    if (!userByPhone) {
      return NextResponse.json({ error: "کاربری با این شماره یافت نشد", details: "ابتدا ثبت‌نام کنید" }, { status: 404 });
    }
  }

  const purpose = mode === "password_reset" ? "PASSWORD_RESET" : "AUTH";
  const cooldownSeconds = getOtpResendCooldownSeconds();
  const cooldownKey = `otp:cooldown:${purpose}:${phone}`;

  const redisRemaining = await cacheGetCooldownRemaining(cooldownKey);
  if (redisRemaining) {
    return NextResponse.json(
      { error: "درخواست پشت‌سرهم مجاز نیست", details: `لطفا ${redisRemaining} ثانیه دیگر دوباره تلاش کنید` },
      { status: 429 },
    );
  }

  const latest = await prisma.otpCode.findFirst({
    where: { phone, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (latest) {
    const elapsedMs = Date.now() - latest.createdAt.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (elapsedSeconds < cooldownSeconds) {
      const remain = cooldownSeconds - elapsedSeconds;
      await cacheSetCooldown(cooldownKey, remain);
      return NextResponse.json(
        { error: "درخواست پشت‌سرهم مجاز نیست", details: `لطفا ${remain} ثانیه دیگر دوباره تلاش کنید` },
        { status: 429 },
      );
    }
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + getOtpExpiryMinutes() * 60 * 1000);
  const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : null;

  const createdOtp = await prisma.otpCode.create({
    data: {
      phone,
      codeHash: hashOtp(phone, code),
      expiresAt,
      purpose,
      username: parsed.data.username || null,
      passwordHash,
    },
  });

  try {
    const smsResult = await sendOtpSms({ phone, code });
    log.info({ phone, mode, purpose, providerMessageId: smsResult.messageId }, "otp sms sent");
  } catch (error: any) {
    log.error({ phone, mode, purpose, error: error?.message }, "otp sms failed");
    await prisma.otpCode.delete({ where: { id: createdOtp.id } }).catch(() => {});
    return NextResponse.json(
      { error: "ارسال پیامک ناموفق بود", details: "در حال حاضر امکان ارسال کد تایید وجود ندارد" },
      { status: 502 },
    );
  }

  await cacheSetCooldown(cooldownKey, cooldownSeconds);
  log.info({ phone, mode, purpose }, "otp requested");

  return NextResponse.json({
    ok: true,
    expiresInSeconds: getOtpExpiryMinutes() * 60,
    sms: { sent: true },
  });
}

export async function verifyAuthOtp(req: Request) {
  const body = await req.json();
  const parsed = verifyOtpSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "payload";
    return NextResponse.json({ error: "داده نامعتبر است", details: `${path}: ${issue?.message || "نامعتبر"}` }, { status: 400 });
  }

  const phone = parsed.data.phone;
  const codeHash = hashOtp(phone, parsed.data.code);

  const otp = await prisma.otpCode.findFirst({
    where: {
      phone,
      codeHash,
      purpose: "AUTH",
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return NextResponse.json({ error: "کد تایید نامعتبر است", details: "کد واردشده اشتباه است یا منقضی شده" }, { status: 401 });
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  let user = await prisma.user.findFirst({ where: { phone } });
  if (!user) {
    if (!otp.username || !otp.passwordHash) {
      return NextResponse.json({ error: "اکانت یافت نشد", details: "برای این شماره ابتدا ثبت‌نام کنید" }, { status: 404 });
    }
    user = await prisma.user.create({
      data: {
        phone,
        username: otp.username || null,
        password: otp.passwordHash || null,
      },
    });
  }

  await createSession({ userId: user.id, phone: user.phone || phone });
  return NextResponse.json({ id: user.id, phone: user.phone || phone });
}

export async function passwordLogin(req: Request) {
  const log = withRequestId(req.headers.get("x-request-id"));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipRate = await checkSlidingWindowLimit({
    key: `rate:login-password:ip:${ip}`,
    limit: Number(process.env.LOGIN_PASSWORD_RATE_LIMIT_IP_MAX || "20"),
    windowSeconds: Number(process.env.LOGIN_PASSWORD_RATE_LIMIT_IP_WINDOW_SECONDS || "60"),
  });

  if (!ipRate.allowed) {
    return NextResponse.json(
      { error: "تعداد درخواست بیش از حد مجاز است", details: `لطفا ${ipRate.retryAfterSeconds} ثانیه دیگر تلاش کنید` },
      { status: 429 },
    );
  }

  const body = await req.json();
  const parsed = passwordLoginSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "payload";
    return NextResponse.json({ error: "داده نامعتبر است", details: `${path}: ${issue?.message || "نامعتبر"}` }, { status: 400 });
  }

  const rawIdentifier = parsed.data.identifier;
  const normalizedPhone = normalizeLoginPhone(rawIdentifier);
  const user = await prisma.user.findFirst({
    where: normalizedPhone
      ? { OR: [{ phone: normalizedPhone }, { username: rawIdentifier }] }
      : { username: rawIdentifier },
  });
  if (!user?.password || !user.phone) {
    log.warn({ identifier: rawIdentifier }, "password login user not found");
    return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.password);
  if (!ok) {
    log.warn({ userId: user.id }, "password login invalid password");
    return NextResponse.json({ error: "رمز عبور اشتباه است" }, { status: 401 });
  }

  await createSession({ userId: user.id, phone: user.phone });
  log.info({ userId: user.id }, "password login success");
  return NextResponse.json({ ok: true });
}

export async function authMe() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { user: null },
      { status: 401, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, phone: true, username: true, avatarUrl: true, smsPreferences: true },
  });
  return NextResponse.json(
    { user: user || session },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}

export async function authLogout() {
  clearSession();
  return NextResponse.json({ ok: true });
}
