import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { withRequestId } from "@/lib/logger";
import { checkSlidingWindowLimit } from "@/lib/rate-limit";

function getMaxAvatarBytes() {
  const mb = Number(process.env.MAX_PROFILE_IMAGE_MB || "2");
  if (Number.isNaN(mb) || mb <= 0) return 2 * 1024 * 1024;
  return mb * 1024 * 1024;
}

export async function POST(req: Request) {
  const log = withRequestId(req.headers.get("x-request-id"));
  try {
    const session = await requireSession();
    const userRate = await checkSlidingWindowLimit({
      key: `rate:avatar-upload:user:${session.userId}`,
      limit: Number(process.env.AVATAR_UPLOAD_RATE_LIMIT_USER_MAX || "10"),
      windowSeconds: Number(process.env.AVATAR_UPLOAD_RATE_LIMIT_USER_WINDOW_SECONDS || "3600"),
    });
    if (!userRate.allowed) {
      return NextResponse.json(
        { error: "تعداد آپلود بیش از حد مجاز است", details: `لطفا ${userRate.retryAfterSeconds} ثانیه دیگر تلاش کنید` },
        { status: 429 },
      );
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

    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: { avatarUrl },
      select: { avatarUrl: true },
    });

    log.info({ userId: session.userId, avatarUrl: updated.avatarUrl }, "avatar updated");
    return NextResponse.json({ ok: true, avatarUrl: updated.avatarUrl });
  } catch {
    log.error("avatar update unauthorized");
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}
