import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReadyRedis } from "@/lib/redis";
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redis = await getReadyRedis();
    if (!redis) throw new Error("Redis unavailable");
    await redis.ping();
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
