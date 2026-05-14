import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { passwordLoginSchema } from "@/lib/validations";
import { checkSlidingWindowLimit } from "@/lib/rate-limit";
import { withRequestId } from "@/lib/logger";

function normalizeLoginPhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.startsWith("09") && digits.length === 11) return digits;
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`;
  if (digits.startsWith("98") && digits.length === 12) return `0${digits.slice(2)}`;
  return null;
}

export async function POST(req: Request) {
  const log = withRequestId(req.headers.get("x-request-id"));

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipRate = await checkSlidingWindowLimit({
    key: `rate:login-password:ip:${ip}`,
    limit: Number(process.env.LOGIN_PASSWORD_RATE_LIMIT_IP_MAX || "20"),
    windowSeconds: Number(process.env.LOGIN_PASSWORD_RATE_LIMIT_IP_WINDOW_SECONDS || "60"),
  });

  if (!ipRate.allowed) {
    return NextResponse.json(
      { error: "تعداد درخواست بیش از حد مجاز است", details: `لطفا ${ipRate.retryAfterSeconds} ثانیه دیگر تلاش کنید` },
      { status: 429 },
    );
  }

  const body = await req.json();
  const parsed = passwordLoginSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "payload";
    return NextResponse.json({ error: "داده نامعتبر است", details: `${path}: ${issue?.message || "invalid"}` }, { status: 400 });
  }

  const rawIdentifier = parsed.data.identifier;
  const normalizedPhone = normalizeLoginPhone(rawIdentifier);
  const user = await prisma.user.findFirst({
    where: normalizedPhone
      ? { OR: [{ phone: normalizedPhone }, { username: rawIdentifier }] }
      : { username: rawIdentifier },
  });
  if (!user?.password || !user.phone) {
    log.warn({ identifier: rawIdentifier }, "password login user not found");
    return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.password);
  if (!ok) {
    log.warn({ userId: user.id }, "password login invalid password");
    return NextResponse.json({ error: "رمز عبور اشتباه است" }, { status: 401 });
  }

  await createSession({ userId: user.id, phone: user.phone });
  log.info({ userId: user.id }, "password login success");
  return NextResponse.json({ ok: true });
}
