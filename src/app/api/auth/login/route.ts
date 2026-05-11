import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "payload";
    return NextResponse.json({ error: "داده نامعتبر است", details: `${path}: ${issue?.message || "invalid"}` }, { status: 400 });
  }

  const username = parsed.data.username.trim();
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ error: "نام کاربری پیدا نشد", details: "ابتدا ثبت‌نام کنید" }, { status: 401 });

  const ok = await bcrypt.compare(parsed.data.password, user.password);
  if (!ok) return NextResponse.json({ error: "رمز عبور اشتباه است", details: "رمز عبور واردشده صحیح نیست" }, { status: 401 });

  await createSession({ userId: user.id, username: user.username });
  return NextResponse.json({ id: user.id, username: user.username });
}
