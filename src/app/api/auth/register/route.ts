import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path?.join(".") || "payload";
      return NextResponse.json({ error: "داده نامعتبر است", details: `${path}: ${issue?.message || "invalid"}` }, { status: 400 });
    }

    const username = parsed.data.username.trim();
    if (username.length < 3) {
      return NextResponse.json({ error: "نام کاربری خیلی کوتاه است", details: "نام کاربری باید حداقل ۳ کاراکتر باشد" }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) {
      return NextResponse.json({ error: "این نام کاربری قبلاً ثبت شده است", details: "لطفاً نام کاربری دیگری انتخاب کنید" }, { status: 409 });
    }

    const password = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({ data: { username, password } });

    return NextResponse.json({ id: user.id, username: user.username });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "این نام کاربری قبلاً ثبت شده است", details: "نام کاربری یکتا نیست" }, { status: 409 });
    }

    return NextResponse.json({ error: "خطا در ثبت‌نام", details: "لطفاً چند لحظه بعد دوباره تلاش کنید" }, { status: 500 });
  }
}
