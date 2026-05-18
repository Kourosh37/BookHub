import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validations";

export async function GET() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, phone: true, avatarUrl: true },
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: "داده نامعتبر است", details: issue?.message || "نامعتبر" }, { status: 400 });
    }
    const username = parsed.data.username?.trim();
    if (username) {
      const exists = await prisma.user.findFirst({
        where: { username, id: { not: session.userId } },
        select: { id: true },
      });
      if (exists) return NextResponse.json({ error: "این نام کاربری قبلاً ثبت شده است" }, { status: 409 });
    }
    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: { ...(username ? { username } : {}) },
      select: { id: true, username: true, phone: true, avatarUrl: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: "برای حذف حساب از مسیر تایید حذف استفاده کنید" },
    { status: 405 },
  );
}
