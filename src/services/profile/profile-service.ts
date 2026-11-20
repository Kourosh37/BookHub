import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, clearSession, createSession } from "@/lib/auth";
import {
  changePasswordSchema,
  updateProfileSchema,
  updateSmsPreferencesSchema,
  verifyOtpSchema,
} from "@/lib/validations";
import { normalizeSmsPreferences } from "@/lib/sms-preferences";
import { guardEntityRateLimit } from "@/lib/anti-abuse";
import { issueOtp, verifyOtpAndRun } from "@/lib/otp-security";
import { HttpError, parseBody, readBytes } from "@/lib/errors";
import { positiveInt } from "@/lib/config";
import { lockUsers } from "@/lib/transaction";
import { cacheDelByPattern } from "@/lib/cache";

const select = {
  id: true,
  username: true,
  phone: true,
  avatarUrl: true,
  smsPreferences: true,
} as const;
const uploadsDir = () =>
  process.env.AVATAR_UPLOAD_DIR ||
  path.resolve(process.cwd(), "public", "uploads", "avatars");
export async function profileGet() {
  const session = await requireSession();
  return NextResponse.json(
    await prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select,
    }),
  );
}
export async function profilePatch(req: Request) {
  const session = await requireSession();
  const data = await parseBody(req, updateProfileSchema);
  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
    select,
  });
  await cacheDelByPattern("schedule:*:summary");
  return NextResponse.json(user);
}
export function profileDeleteMethodNotAllowed() {
  return NextResponse.json(
    { error: "Use delete confirmation endpoint" },
    { status: 405 },
  );
}
export async function profileSmsPreferencesGet() {
  const session = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { smsPreferences: true },
  });
  return NextResponse.json(normalizeSmsPreferences(user.smsPreferences));
}
export async function profileSmsPreferencesPatch(req: Request) {
  const session = await requireSession();
  const data = await parseBody(req, updateSmsPreferencesSchema);
  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: { smsPreferences: data },
    select: { smsPreferences: true },
  });
  return NextResponse.json(updated.smsPreferences);
}
export async function profilePasswordRequestOtp() {
  const session = await requireSession();
  return NextResponse.json(await issueOtp(session.phone, "PASSWORD_RESET"));
}
export async function profilePasswordConfirm(req: Request) {
  const session = await requireSession();
  const data = await parseBody(req, changePasswordSchema);
  const password = await bcrypt.hash(data.newPassword, 12);
  const user = await verifyOtpAndRun(
    session.phone,
    data.code,
    "PASSWORD_RESET",
    async (tx) =>
      tx.user.update({
        where: { id: session.userId },
        data: { password, sessionVersion: { increment: 1 } },
      }),
  );
  await createSession({
    userId: user.id,
    phone: user.phone!,
    sessionVersion: user.sessionVersion,
  });
  return NextResponse.json({ ok: true });
}
export async function profileDeleteRequestOtp() {
  const session = await requireSession();
  return NextResponse.json(await issueOtp(session.phone, "ACCOUNT_DELETE"));
}
export async function profileDeleteConfirm(req: Request) {
  const session = await requireSession();
  const data = await parseBody(
    req,
    z.object({ code: verifyOtpSchema.shape.code }),
  );
  await verifyOtpAndRun(
    session.phone,
    data.code,
    "ACCOUNT_DELETE",
    async (tx) => {
      await lockUsers(tx, [session.userId]);
      const bookings = await tx.booking.findMany({
        where: {
          bookedByUserId: session.userId,
          status: "CONFIRMED",
          schedule: { userId: { not: session.userId } },
        },
        select: { id: true, timeSlotId: true },
      });
      await tx.booking.updateMany({
        where: { id: { in: bookings.map((b) => b.id) } },
        data: { status: "CANCELED", canceledAt: new Date() },
      });
      await tx.timeSlot.updateMany({
        where: { id: { in: bookings.map((b) => b.timeSlotId) } },
        data: { isBooked: false },
      });
      const hosted = await tx.booking.findMany({
        where: { schedule: { userId: session.userId } },
        select: { id: true },
      });
      await tx.notificationJob.updateMany({
        where: {
          OR: [
            { recipientUserId: session.userId },
            { bookingId: { in: [...bookings, ...hosted].map((b) => b.id) } },
          ],
          sentAt: null,
        },
        data: { canceledAt: new Date() },
      });
      await tx.user.delete({ where: { id: session.userId } });
      await tx.otpCode.deleteMany({ where: { phone: session.phone } });
      return true;
    },
  );
  await clearSession();
  await cacheDelByPattern("schedule:*");
  return NextResponse.json({ ok: true });
}

export async function sanitizeAvatar(buffer: Buffer) {
  const raster =
    buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii")) ||
    (buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP");
  if (!raster) throw new HttpError(400, "Only valid raster images are allowed");
  try {
    const image = sharp(buffer, {
      limitInputPixels: 16_000_000,
      animated: false,
      failOn: "warning",
    });
    const meta = await image.metadata();
    if (!meta.format || !["jpeg", "png", "webp", "gif"].includes(meta.format))
      throw new Error("Unsupported image");
    return await image
      .rotate()
      .resize(512, 512, { fit: "cover", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new HttpError(
      400,
      "Only valid JPEG, PNG, WebP, or GIF images are allowed",
    );
  }
}
export async function profileAvatarUpload(req: Request) {
  const session = await requireSession();
  const rate = await guardEntityRateLimit({
    keyPrefix: "rate:avatar",
    entity: session.userId,
    limit: positiveInt(process.env.AVATAR_UPLOAD_RATE_LIMIT_USER_MAX, 10),
    windowSeconds: 3600,
  });
  if (!rate.allowed)
    throw new HttpError(429, "Too many uploads", rate.retryAfterSeconds);
  const max =
    positiveInt(process.env.MAX_PROFILE_IMAGE_MB, 2, 10) * 1024 * 1024;
  if (Number(req.headers.get("content-length")) > max + 65536)
    throw new HttpError(413, "File is too large");
  const bytes = await readBytes(req, max + 65536);
  let form: FormData;
  try {
    form = await new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: bytes,
    }).formData();
  } catch {
    throw new HttpError(400, "Invalid multipart upload");
  }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size)
    throw new HttpError(400, "File is required");
  if (file.size > max) throw new HttpError(413, "File is too large");
  const buffer = await sanitizeAvatar(Buffer.from(await file.arrayBuffer()));
  const fileName = `${session.userId}-${randomUUID()}.jpg`;
  const fullPath = path.join(uploadsDir(), fileName);
  await mkdir(uploadsDir(), { recursive: true });
  await writeFile(fullPath, buffer, { flag: "wx" });
  let previous: string | null = null;
  try {
    const user = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, [session.userId]);
      const current = await tx.user.findUniqueOrThrow({
        where: { id: session.userId },
        select: { avatarUrl: true },
      });
      previous = current.avatarUrl;
      return tx.user.update({
        where: { id: session.userId },
        data: { avatarUrl: `/api/profile/avatar/file/${fileName}` },
        select: { avatarUrl: true },
      });
    });
    await removeAvatarFile(previous);
    return NextResponse.json({ ok: true, avatarUrl: user.avatarUrl });
  } catch (error) {
    await unlink(fullPath).catch(() => {});
    throw error;
  }
}
async function removeAvatarFile(url: string | null) {
  const name = url?.split("/").pop()?.split("?")[0];
  if (name && /^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|gif)$/.test(name))
    await unlink(path.join(uploadsDir(), name)).catch(() => {});
}
export async function profileAvatarDelete(_req: Request) {
  const session = await requireSession();
  const previous = await prisma.$transaction(async (tx) => {
    await lockUsers(tx, [session.userId]);
    const user = await tx.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: { avatarUrl: true },
    });
    await tx.user.update({
      where: { id: session.userId },
      data: { avatarUrl: null },
    });
    return user.avatarUrl;
  });
  await removeAvatarFile(previous);
  return NextResponse.json({ ok: true, avatarUrl: null });
}
export async function profileAvatarFileGet(fileName: string) {
  if (!/^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|gif)$/.test(fileName))
    throw new HttpError(404, "File not found");
  try {
    // Re-encode legacy uploads as well: stored files are never served as active SVG.
    const image = await sanitizeAvatar(
      await readFile(path.join(uploadsDir(), fileName)),
    );
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    throw new HttpError(404, "File not found");
  }
}
