import { NextResponse } from "next/server";
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

  const phone = parsed.data.phone;
  const cooldownSeconds = getOtpResendCooldownSeconds();
  const latest = await prisma.otpCode.findFirst({
    where: { phone },
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

  await prisma.otpCode.create({
    data: {
      phone,
      codeHash: hashOtp(phone, code),
      expiresAt,
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
