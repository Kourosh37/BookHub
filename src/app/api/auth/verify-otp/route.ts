import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOtpSchema } from "@/lib/validations";
import { createSession } from "@/lib/auth";
import { hashOtp } from "@/lib/otp";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = verifyOtpSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "payload";
    return NextResponse.json({ error: "داده نامعتبر است", details: `${path}: ${issue?.message || "invalid"}` }, { status: 400 });
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
