import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatInTimeZone } from "date-fns-tz";
import { requireSession } from "@/lib/auth";
import { cacheGetJson, cacheSetJson } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { shareId: string } }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "نیاز به ورود", details: "برای مشاهده برنامه باید وارد حساب شوید" }, { status: 401 });
  }

  const cacheKey = `schedule:${params.shareId}:summary`;
  const cached = await cacheGetJson<any>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "X-Cache": "HIT" },
    });
  }

  const schedule = await prisma.schedule.findUnique({
    where: { shareId: params.shareId },
    select: {
      id: true,
      title: true,
      questions: true,
      daysConfig: true,
      slotDuration: true,
      gapMinutes: true,
      user: { select: { id: true, username: true, phone: true, avatarUrl: true } },
    },
  });

  if (!schedule) return NextResponse.json({ error: "برنامه پیدا نشد" }, { status: 404 });

  const availableSlots = await prisma.timeSlot.findMany({
    where: { scheduleId: schedule.id, isBooked: false, startTime: { gte: new Date() } },
    select: { startTime: true },
  });

  const availableDates = Array.from(new Set(availableSlots.map((s) => formatInTimeZone(s.startTime, "Asia/Tehran", "yyyy-MM-dd"))));

  const payload = { ...schedule, availableDates };
  await cacheSetJson(cacheKey, payload, 30);
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "X-Cache": "MISS" },
  });
}
