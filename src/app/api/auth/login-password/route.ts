import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { passwordLoginSchema } from "@/lib/validations";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = passwordLoginSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "payload";
    return NextResponse.json({ error: "داده نامعتبر است", details: `${path}: ${issue?.message || "invalid"}` }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { username: parsed.data.username } });
  if (!user?.password || !user.phone) {
    return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.password);
  if (!ok) {
    return NextResponse.json({ error: "رمز عبور اشتباه است" }, { status: 401 });
  }

  await createSession({ userId: user.id, phone: user.phone });
  return NextResponse.json({ ok: true });
}
