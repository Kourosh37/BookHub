import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatInTimeZone } from "date-fns-tz";

export async function GET(req: Request, { params }: { params: { shareId: string } }) {
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
  return NextResponse.json(filtered);
}
