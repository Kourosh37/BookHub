import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertAdminConfig, clearAdminCookie, getAdminUsername, isAdminRequest, isAdminSession, setAdminCookie, verifyAdminCredentials } from "@/lib/admin-auth";
import { getSmsGlobalSettings, updateSmsGlobalSettings } from "@/lib/admin-sms-settings";
import { updateAdminSmsSettingsSchema } from "@/lib/validations";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function adminLogin(req: Request) {
  try {
    assertAdminConfig();
  } catch {
    return NextResponse.json({ error: "تنظیمات ادمین کامل نیست" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "نام کاربری یا رمز عبور ناقص است" }, { status: 400 });
  }

  if (!verifyAdminCredentials(username, password)) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setAdminCookie(res);
  return res;
}

export async function adminLogout() {
  const res = NextResponse.json({ ok: true });
  clearAdminCookie(res);
  return res;
}

export async function adminMe() {
  const username = getAdminUsername();
  if (!username) return NextResponse.json({ ok: false, configured: false }, { status: 500 });
  if (!isAdminSession()) return NextResponse.json({ ok: false, configured: true }, { status: 401 });
  return NextResponse.json({ ok: true, configured: true, username });
}

export async function adminOverview(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });

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

  const smsCounts = { OTP: 0, BOOKING_CREATED: 0, BOOKING_CANCELED: 0, BOOKING_REMINDER: 0, GENERIC: 0 } as Record<string, number>;
  smsCountsRaw.forEach((row) => {
    smsCounts[row.type] = row._count._all;
  });

  const smsSettings = await getSmsGlobalSettings();
  return NextResponse.json({
    stats: { totalUsers, totalSchedules, totalBookings, bookingsToday, bookingsWeek, bookingsMonth, sessionsToday, sessionsWeek, sessionsMonth, upcomingSessions },
    smsCounts,
    smsSettings,
  });
}

export async function adminSmsSettingsGet(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  const settings = await getSmsGlobalSettings();
  return NextResponse.json(settings);
}

export async function adminSmsSettingsPatch(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = updateAdminSmsSettingsSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: "داده نامعتبر است", details: issue?.message || "نامعتبر" }, { status: 400 });
  }
  const updated = await updateSmsGlobalSettings(parsed.data);
  return NextResponse.json(updated);
}

export async function adminUsers(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const page = Math.max(Number(searchParams.get("page") || 1), 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") || 50), 1), 200);
  const query = (searchParams.get("q") || "").trim();

  const where: Prisma.UserWhereInput = query
    ? { OR: [{ phone: { contains: query, mode: Prisma.QueryMode.insensitive } }, { username: { contains: query, mode: Prisma.QueryMode.insensitive } }] }
    : {};

  const [total, items] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, phone: true, username: true, avatarUrl: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}
