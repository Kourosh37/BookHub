import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatInTimeZone } from "date-fns-tz";

export async function GET(_: Request, { params }: { params: { shareId: string } }) {
  const schedule = await prisma.schedule.findUnique({
    where: { shareId: params.shareId },
    select: { id: true, title: true, questions: true, daysConfig: true, slotDuration: true, gapMinutes: true },
  });

  if (!schedule) return NextResponse.json({ error: "برنامه پیدا نشد" }, { status: 404 });

  const availableSlots = await prisma.timeSlot.findMany({
    where: { scheduleId: schedule.id, isBooked: false, startTime: { gte: new Date() } },
    select: { startTime: true },
  });

  const availableDates = Array.from(new Set(availableSlots.map((s) => formatInTimeZone(s.startTime, "Asia/Tehran", "yyyy-MM-dd"))));

  return NextResponse.json({ ...schedule, availableDates });
}
