import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import { cleanupExpiredBookingsAndSlots } from "@/lib/cleanup";
import { handleRoute, HttpError } from "@/lib/errors";
const hash = (value: string) => createHash("sha256").update(value).digest();
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const secret = process.env.CRON_SECRET;
    const received =
      req.headers.get("authorization")?.replace(/^Bearer /, "") ||
      req.headers.get("x-cron-secret") ||
      "";
    if (
      !secret ||
      secret.length < 32 ||
      !timingSafeEqual(hash(secret), hash(received))
    )
      throw new HttpError(401, "Unauthorized");
    return NextResponse.json({
      ok: true,
      ...(await cleanupExpiredBookingsAndSlots()),
    });
  });
}
