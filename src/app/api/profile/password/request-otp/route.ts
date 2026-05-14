import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { generateOtpCode, getOtpExpiryMinutes, getOtpResendCooldownSeconds, hashOtp } from "@/lib/otp";
import { sendOtpSms } from "@/lib/sms";

export async function POST() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { phone: true } });
    if (!user?.phone) return NextResponse.json({ error: "شماره موبایل یافت نشد" }, { status: 400 });

    const cooldownSeconds = getOtpResendCooldownSeconds();
    const latest = await prisma.otpCode.findFirst({
      where: { phone: user.phone, purpose: "PASSWORD_RESET" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (latest) {
      const elapsed = Math.floor((Date.now() - latest.createdAt.getTime()) / 1000);
      if (elapsed < cooldownSeconds) {
        return NextResponse.json({ error: "درخواست پشت‌سرهم مجاز نیست", details: `لطفا ${cooldownSeconds - elapsed} ثانیه دیگر تلاش کنید` }, { status: 429 });
      }
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + getOtpExpiryMinutes() * 60 * 1000);
    await prisma.otpCode.create({
      data: {
        phone: user.phone,
        codeHash: hashOtp(user.phone, code),
        purpose: "PASSWORD_RESET",
        expiresAt,
      },
    });
    await sendOtpSms({ phone: user.phone, code });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "ارسال کد ناموفق بود", details: error?.message || "در حال حاضر امکان ارسال کد تایید وجود ندارد" },
      { status: 500 },
    );
  }
}
