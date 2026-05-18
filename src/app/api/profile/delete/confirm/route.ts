import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { hashOtp } from "@/lib/otp";
import { normalizeOtpCode } from "@/lib/phone";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { phone: true } });
    if (!user?.phone) return NextResponse.json({ error: "شماره موبایل یافت نشد" }, { status: 400 });

    const body = await req.json();
    const rawCode = normalizeOtpCode(body?.code ?? "");
    if (!/^\d{6}$/.test(rawCode)) {
      return NextResponse.json({ error: "کد تایید باید ۶ رقم باشد" }, { status: 400 });
    }

    const otp = await prisma.otpCode.findFirst({
      where: {
        phone: user.phone,
        codeHash: hashOtp(user.phone, rawCode),
        purpose: "ACCOUNT_DELETE",
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) return NextResponse.json({ error: "کد تایید نامعتبر است" }, { status: 401 });

    await prisma.$transaction(async (tx) => {
      await tx.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      await tx.user.delete({ where: { id: session.userId } });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}
