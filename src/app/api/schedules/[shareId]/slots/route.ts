import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatInTimeZone } from "date-fns-tz";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { shareId: string } }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "نیاز به ورود", details: "برای مشاهده بازه‌ها باید وارد حساب شوید" }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "تاریخ لازم است" }, { status: 400 });

  const schedule = await prisma.schedule.findUnique({ where: { shareId: params.shareId }, select: { id: true } });
  if (!schedule) return NextResponse.json({ error: "برنامه پیدا نشد" }, { status: 404 });

  const slots = await prisma.timeSlot.findMany({
    where: { scheduleId: schedule.id, isBooked: false, startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
  });

  const filtered = slots.filter((s) => formatInTimeZone(s.startTime, "Asia/Tehran", "yyyy-MM-dd") === date);
  return NextResponse.json(filtered, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
