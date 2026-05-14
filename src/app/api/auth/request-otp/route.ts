import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requestOtpSchema } from "@/lib/validations";
import { generateOtpCode, getOtpExpiryMinutes, getOtpResendCooldownSeconds, hashOtp } from "@/lib/otp";
import { sendOtpSms } from "@/lib/sms";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = requestOtpSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "payload";
    return NextResponse.json({ error: "داده نامعتبر است", details: `${path}: ${issue?.message || "invalid"}` }, { status: 400 });
  }

  const { phone, mode } = parsed.data;

  if (mode === "register") {
    const userByPhone = await prisma.user.findFirst({ where: { phone } });
    if (userByPhone) return NextResponse.json({ error: "این شماره قبلاً ثبت شده است" }, { status: 409 });
    if (parsed.data.username) {
      const userByUsername = await prisma.user.findFirst({ where: { username: parsed.data.username } });
      if (userByUsername) return NextResponse.json({ error: "این نام کاربری قبلاً ثبت شده است" }, { status: 409 });
    }
  }

  const cooldownSeconds = getOtpResendCooldownSeconds();
  const latest = await prisma.otpCode.findFirst({
    where: { phone, purpose: mode === "password_reset" ? "PASSWORD_RESET" : "AUTH" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (latest) {
    const elapsedMs = Date.now() - latest.createdAt.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (elapsedSeconds < cooldownSeconds) {
      return NextResponse.json(
        { error: "درخواست پشت‌سرهم مجاز نیست", details: `لطفا ${cooldownSeconds - elapsedSeconds} ثانیه دیگر دوباره تلاش کنید` },
        { status: 429 },
      );
    }
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + getOtpExpiryMinutes() * 60 * 1000);

  const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : null;

  await prisma.otpCode.create({
    data: {
      phone,
      codeHash: hashOtp(phone, code),
      expiresAt,
      purpose: mode === "password_reset" ? "PASSWORD_RESET" : "AUTH",
      username: parsed.data.username || null,
      passwordHash,
    },
  });

  let smsResult;
  try {
    smsResult = await sendOtpSms({ phone, code });
  } catch {
    return NextResponse.json(
      { error: "ارسال پیامک ناموفق بود", details: "در حال حاضر امکان ارسال کد تایید وجود ندارد" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    expiresInSeconds: getOtpExpiryMinutes() * 60,
    sms: smsResult,
  });
}
