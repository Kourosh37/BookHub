import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validations";
import { hashOtp } from "@/lib/otp";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { phone: true } });
    if (!user?.phone) return NextResponse.json({ error: "شماره موبایل یافت نشد" }, { status: 400 });

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: "داده نامعتبر است", details: issue?.message || "invalid" }, { status: 400 });
    }

    const otp = await prisma.otpCode.findFirst({
      where: {
        phone: user.phone,
        codeHash: hashOtp(user.phone, parsed.data.code),
        purpose: "PASSWORD_RESET",
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) return NextResponse.json({ error: "کد تایید نامعتبر است" }, { status: 401 });

    await prisma.$transaction(async (tx) => {
      await tx.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      await tx.user.update({
        where: { id: session.userId },
        data: { password: await bcrypt.hash(parsed.data.newPassword, 12) },
      });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}
