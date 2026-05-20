import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { changePasswordSchema, updateProfileSchema, updateSmsPreferencesSchema } from "@/lib/validations";
import { generateOtpCode, getOtpExpiryMinutes, getOtpResendCooldownSeconds, hashOtp } from "@/lib/otp";
import { normalizeOtpCode } from "@/lib/phone";
import { sendOtpSms } from "@/lib/sms";
import { normalizeSmsPreferences } from "@/lib/sms-preferences";
import { withRequestId } from "@/lib/logger";
import { checkSlidingWindowLimit } from "@/lib/rate-limit";

function getMaxAvatarBytes() {
  const mb = Number(process.env.MAX_PROFILE_IMAGE_MB || "2");
  if (Number.isNaN(mb) || mb <= 0) return 2 * 1024 * 1024;
  return mb * 1024 * 1024;
}

function contentTypeFromFileName(fileName: string) {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "application/octet-stream";
}

export async function profileGet() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, phone: true, avatarUrl: true, smsPreferences: true },
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}

export async function profilePatch(req: Request) {
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
      const exists = await prisma.user.findFirst({ where: { username, id: { not: session.userId } }, select: { id: true } });
      if (exists) return NextResponse.json({ error: "این نام کاربری قبلاً ثبت شده است" }, { status: 409 });
    }
    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: { ...(username ? { username } : {}) },
      select: { id: true, username: true, phone: true, avatarUrl: true, smsPreferences: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}

export function profileDeleteMethodNotAllowed() {
  return NextResponse.json({ error: "برای حذف حساب از مسیر تایید حذف استفاده کنید" }, { status: 405 });
}

export async function profileSmsPreferencesGet() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { smsPreferences: true } });
    return NextResponse.json(normalizeSmsPreferences(user?.smsPreferences ?? null));
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}

export async function profileSmsPreferencesPatch(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = updateSmsPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: "داده نامعتبر است", details: issue?.message || "نامعتبر" }, { status: 400 });
    }
    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: { smsPreferences: parsed.data },
      select: { smsPreferences: true },
    });
    return NextResponse.json(normalizeSmsPreferences(updated.smsPreferences ?? null));
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}

export async function profilePasswordRequestOtp() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { phone: true } });
    if (!user?.phone) return NextResponse.json({ error: "شماره موبایل یافت نشد" }, { status: 400 });

    const cooldownSeconds = getOtpResendCooldownSeconds();
    const latest = await prisma.otpCode.findFirst({ where: { phone: user.phone, purpose: "PASSWORD_RESET" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (latest) {
      const elapsed = Math.floor((Date.now() - latest.createdAt.getTime()) / 1000);
      if (elapsed < cooldownSeconds) {
        return NextResponse.json({ error: "درخواست پشت‌سرهم مجاز نیست", details: `لطفا ${cooldownSeconds - elapsed} ثانیه دیگر تلاش کنید` }, { status: 429 });
      }
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + getOtpExpiryMinutes() * 60 * 1000);
    await prisma.otpCode.create({ data: { phone: user.phone, codeHash: hashOtp(user.phone, code), purpose: "PASSWORD_RESET", expiresAt } });
    await sendOtpSms({ phone: user.phone, code });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
    return NextResponse.json({ error: "ارسال کد ناموفق بود", details: error?.message || "در حال حاضر امکان ارسال کد تایید وجود ندارد" }, { status: 500 });
  }
}

export async function profilePasswordConfirm(req: Request) {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { phone: true } });
    if (!user?.phone) return NextResponse.json({ error: "شماره موبایل یافت نشد" }, { status: 400 });
    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: "داده نامعتبر است", details: issue?.message || "نامعتبر" }, { status: 400 });
    }

    const otp = await prisma.otpCode.findFirst({
      where: { phone: user.phone, codeHash: hashOtp(user.phone, parsed.data.code), purpose: "PASSWORD_RESET", consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) return NextResponse.json({ error: "کد تایید نامعتبر است" }, { status: 401 });

    await prisma.$transaction(async (tx) => {
      await tx.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      await tx.user.update({ where: { id: session.userId }, data: { password: await bcrypt.hash(parsed.data.newPassword, 12) } });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}

export async function profileDeleteRequestOtp() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { phone: true } });
    if (!user?.phone) return NextResponse.json({ error: "شماره موبایل یافت نشد" }, { status: 400 });
    const cooldownSeconds = getOtpResendCooldownSeconds();
    const latest = await prisma.otpCode.findFirst({ where: { phone: user.phone, purpose: "ACCOUNT_DELETE" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (latest) {
      const elapsed = Math.floor((Date.now() - latest.createdAt.getTime()) / 1000);
      if (elapsed < cooldownSeconds) {
        return NextResponse.json({ error: "درخواست پشت‌سرهم مجاز نیست", details: `لطفا ${cooldownSeconds - elapsed} ثانیه دیگر تلاش کنید` }, { status: 429 });
      }
    }
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + getOtpExpiryMinutes() * 60 * 1000);
    await prisma.otpCode.create({ data: { phone: user.phone, codeHash: hashOtp(user.phone, code), purpose: "ACCOUNT_DELETE", expiresAt } });
    await sendOtpSms({ phone: user.phone, code });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
    return NextResponse.json({ error: "ارسال کد ناموفق بود", details: error?.message || "در حال حاضر امکان ارسال کد تایید وجود ندارد" }, { status: 500 });
  }
}

export async function profileDeleteConfirm(req: Request) {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { phone: true } });
    if (!user?.phone) return NextResponse.json({ error: "شماره موبایل یافت نشد" }, { status: 400 });
    const body = await req.json();
    const rawCode = normalizeOtpCode(body?.code ?? "");
    if (!/^\d{6}$/.test(rawCode)) return NextResponse.json({ error: "کد تایید باید ۶ رقم باشد" }, { status: 400 });

    const otp = await prisma.otpCode.findFirst({
      where: { phone: user.phone, codeHash: hashOtp(user.phone, rawCode), purpose: "ACCOUNT_DELETE", consumedAt: null, expiresAt: { gt: new Date() } },
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

export async function profileAvatarUpload(req: Request) {
  const log = withRequestId(req.headers.get("x-request-id"));
  try {
    const session = await requireSession();
    const userRate = await checkSlidingWindowLimit({
      key: `rate:avatar-upload:user:${session.userId}`,
      limit: Number(process.env.AVATAR_UPLOAD_RATE_LIMIT_USER_MAX || "10"),
      windowSeconds: Number(process.env.AVATAR_UPLOAD_RATE_LIMIT_USER_WINDOW_SECONDS || "3600"),
    });
    if (!userRate.allowed) {
      return NextResponse.json({ error: "تعداد آپلود بیش از حد مجاز است", details: `لطفا ${userRate.retryAfterSeconds} ثانیه دیگر تلاش کنید` }, { status: 429 });
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "فایل ارسال نشده است" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "فرمت فایل معتبر نیست" }, { status: 400 });
    if (file.size > getMaxAvatarBytes()) {
      return NextResponse.json({ error: "حجم فایل بیش از حد مجاز است", details: `حداکثر ${process.env.MAX_PROFILE_IMAGE_MB || "2"} مگابایت` }, { status: 400 });
    }
    const ext = (file.type.split("/")[1] || "jpg").replace(/[^a-zA-Z0-9]/g, "");
    const fileName = `${session.userId}-${randomUUID()}.${ext}`;
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(uploadsDir, { recursive: true });
    const fullPath = path.join(uploadsDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buffer);
    const avatarUrl = `/api/profile/avatar/file/${fileName}`;
    const updated = await prisma.user.update({ where: { id: session.userId }, data: { avatarUrl }, select: { avatarUrl: true } });
    log.info({ userId: session.userId, avatarUrl: updated.avatarUrl }, "avatar updated");
    return NextResponse.json({ ok: true, avatarUrl: updated.avatarUrl });
  } catch {
    log.error("avatar update unauthorized");
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}

export async function profileAvatarDelete(req: Request) {
  const log = withRequestId(req.headers.get("x-request-id"));
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { avatarUrl: true } });
    const avatarUrl = user?.avatarUrl || "";
    if (avatarUrl) {
      const fileName = avatarUrl.split("/").pop()?.split("?")[0];
      if (fileName) {
        const filePath = path.join(process.cwd(), "public", "uploads", "avatars", fileName);
        await unlink(filePath).catch(() => {});
      }
    }
    await prisma.user.update({ where: { id: session.userId }, data: { avatarUrl: null } });
    log.info({ userId: session.userId }, "avatar removed");
    return NextResponse.json({ ok: true, avatarUrl: null });
  } catch {
    log.error("avatar remove unauthorized");
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}

export async function profileAvatarFileGet(fileName: string) {
  try {
    const safeName = path.basename(fileName || "");
    if (!safeName) return NextResponse.json({ error: "نام فایل نامعتبر است" }, { status: 400 });
    const fullPath = path.join(process.cwd(), "public", "uploads", "avatars", safeName);
    const file = await readFile(fullPath);
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFromFileName(safeName),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "فایل یافت نشد" }, { status: 404 });
  }
}
