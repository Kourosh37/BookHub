import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "داده نامعتبر است" }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (exists) return NextResponse.json({ error: "نام کاربری تکراری است" }, { status: 409 });

  const password = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({ data: { username: parsed.data.username, password } });

  return NextResponse.json({ id: user.id, username: user.username });
}
