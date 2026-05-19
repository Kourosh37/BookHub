import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSmsGlobalSettings } from "@/lib/admin-sms-settings";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 30);

  const [totalUsers, totalSchedules, totalBookings, bookingsToday, bookingsWeek, bookingsMonth, sessionsToday, sessionsWeek, sessionsMonth, upcomingSessions] =
    await prisma.$transaction([
      prisma.user.count(),
      prisma.schedule.count(),
      prisma.booking.count(),
      prisma.booking.count({ where: { bookedAt: { gte: todayStart, lte: now } } }),
      prisma.booking.count({ where: { bookedAt: { gte: weekStart, lte: now } } }),
      prisma.booking.count({ where: { bookedAt: { gte: monthStart, lte: now } } }),
      prisma.booking.count({ where: { timeSlot: { startTime: { gte: todayStart, lte: now } } } }),
      prisma.booking.count({ where: { timeSlot: { startTime: { gte: weekStart, lte: now } } } }),
      prisma.booking.count({ where: { timeSlot: { startTime: { gte: monthStart, lte: now } } } }),
      prisma.booking.count({ where: { timeSlot: { startTime: { gte: now } } } }),
    ]);

  const smsCountsRaw = await prisma.smsLog.groupBy({
    by: ["type"],
    _count: { _all: true },
    where: { status: "SENT" },
  });

  const smsCounts = {
    OTP: 0,
    BOOKING_CREATED: 0,
    BOOKING_CANCELED: 0,
    BOOKING_REMINDER: 0,
    GENERIC: 0,
  } as Record<string, number>;

  smsCountsRaw.forEach((row) => {
    smsCounts[row.type] = row._count._all;
  });

  const smsSettings = await getSmsGlobalSettings();

  return NextResponse.json({
    stats: {
      totalUsers,
      totalSchedules,
      totalBookings,
      bookingsToday,
      bookingsWeek,
      bookingsMonth,
      sessionsToday,
      sessionsWeek,
      sessionsMonth,
      upcomingSessions,
    },
    smsCounts,
    smsSettings,
  });
}
