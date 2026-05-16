import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requestOtpSchema } from "@/lib/validations";
import { generateOtpCode, getOtpExpiryMinutes, getOtpResendCooldownSeconds, hashOtp } from "@/lib/otp";
import { cacheGetCooldownRemaining, cacheSetCooldown } from "@/lib/cache";
import { withRequestId } from "@/lib/logger";
import { sendOtpSms } from "@/lib/sms";
import { checkSlidingWindowLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
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
