import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredBookingsAndSlots } from "@/lib/cleanup";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") || "";
  if (bearer === `Bearer ${secret}`) return true;
  const headerSecret = req.headers.get("x-cron-secret");
  return headerSecret === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await cleanupExpiredBookingsAndSlots({ force: true });
  return NextResponse.json({ ok: true });
}
