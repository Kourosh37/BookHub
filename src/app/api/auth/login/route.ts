import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "داده نامعتبر است" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (!user) return NextResponse.json({ error: "اطلاعات ورود نادرست است" }, { status: 401 });

  const ok = await bcrypt.compare(parsed.data.password, user.password);
  if (!ok) return NextResponse.json({ error: "اطلاعات ورود نادرست است" }, { status: 401 });

  await createSession({ userId: user.id, username: user.username });
  return NextResponse.json({ id: user.id, username: user.username });
}
