import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { scheduleSchema, updateScheduleTitleSchema, bookingSchema } from "@/lib/validations";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { randomBytes } from "crypto";
import { cacheDelByPattern, cacheGetJson, cacheSetJson } from "@/lib/cache";
import { describeConflict, getUserBookingsInRange, rangesOverlap } from "@/lib/time-conflicts";
import { notifyBookingCreated, scheduleTenMinuteReminderForBooking } from "@/lib/notifications";

type Range = { startTime: string; endTime: string };
type DayInput = { date: string; ranges: Range[] };

function createShareId() {
  return randomBytes(4).toString("hex");
}
function toMinutes(v: string) {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}
function validateRanges(ranges: Range[]) {
  const sorted = [...ranges].map((r) => ({ ...r, s: toMinutes(r.startTime), e: toMinutes(r.endTime) })).sort((a, b) => a.s - b.s);
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].e <= sorted[i].s) return "Invalid time range.";
    if (i > 0 && sorted[i].s < sorted[i - 1].e) return "Overlapping ranges are not allowed.";
  }
  return null;
}
function normalizeDays(days: DayInput[]) {
  const map = new Map<string, Range[]>();
  for (const d of days) map.set(d.date, [...(map.get(d.date) || []), ...d.ranges]);
  return Array.from(map.entries()).map(([date, ranges]) => ({ date, ranges }));
}

export async function schedulesCreate(req: Request) {
  let session: { userId: string } | null = null;
  try {
    session = await requireSession();
    const body = await req.json();
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const path = firstIssue?.path?.join(".") || "payload";
      const message = firstIssue?.message || "Invalid payload";
      return NextResponse.json({ error: "Invalid request payload", details: `${path}: ${message}` }, { status: 400 });
    }

    const normalizedDays = normalizeDays(parsed.data.daysConfig as DayInput[]);
    const todayInTehran = formatInTimeZone(new Date(), "Asia/Tehran", "yyyy-MM-dd");
    for (const day of normalizedDays) {
      if (day.date < todayInTehran) {
        return NextResponse.json({ error: `Past date is not allowed: ${day.date}` }, { status: 400 });
      }
    }

    for (const day of normalizedDays) {
      const err = validateRanges(day.ranges);
      if (err) return NextResponse.json({ error: `${day.date}: ${err}` }, { status: 400 });
    }

    const slots: { startTime: Date; endTime: Date }[] = [];
    for (const day of normalizedDays) {
      const [year, month, date] = day.date.split("-").map(Number);
      for (const range of day.ranges) {
        const [sh, sm] = range.startTime.split(":").map(Number);
        const [eh, em] = range.endTime.split(":").map(Number);
        let cur = new Date(year, month - 1, date, sh, sm, 0);
        const end = new Date(year, month - 1, date, eh, em, 0);
        while (cur < end) {
          const slotEnd = new Date(cur.getTime() + parsed.data.slotDuration * 60000);
          if (slotEnd > end) break;
          slots.push({ startTime: fromZonedTime(cur, "Asia/Tehran"), endTime: fromZonedTime(slotEnd, "Asia/Tehran") });
          cur = new Date(cur.getTime() + (parsed.data.slotDuration + parsed.data.gapMinutes) * 60000);
        }
      }
    }

    if (!slots.length) return NextResponse.json({ error: "No valid slots generated" }, { status: 400 });

    const minStart = new Date(Math.min(...slots.map((s) => s.startTime.getTime())));
    const maxEnd = new Date(Math.max(...slots.map((s) => s.endTime.getTime())));
    const existing = await getUserBookingsInRange(session.userId, minStart, maxEnd);
    const conflicting = slots.find((slot) => existing.some((b) => rangesOverlap(slot.startTime, slot.endTime, b.timeSlot.startTime, b.timeSlot.endTime)));
    if (conflicting) {
      const hit = existing.find((b) => rangesOverlap(conflicting.startTime, conflicting.endTime, b.timeSlot.startTime, b.timeSlot.endTime));
      return NextResponse.json({ error: "Schedule conflicts with existing sessions", details: hit ? `Conflict: ${describeConflict(hit)}` : "Conflict detected" }, { status: 409 });
    }

    const schedule = await prisma.schedule.create({
      data: {
        shareId: createShareId(),
        userId: session.userId,
        title: parsed.data.title,
        questions: parsed.data.questions,
        daysConfig: normalizedDays,
        slotDuration: parsed.data.slotDuration,
        gapMinutes: parsed.data.gapMinutes,
      },
    });

    await prisma.timeSlot.createMany({ data: slots.map((s) => ({ ...s, scheduleId: schedule.id })), skipDuplicates: true });
    void cacheDelByPattern(`schedule:${schedule.shareId}:*`).catch(() => {});
    return NextResponse.json({ id: schedule.id, shareId: schedule.shareId, title: schedule.title, createdAt: schedule.createdAt });
  } catch (error: any) {
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed to create schedule", details: error?.message || "Unknown error" }, { status: 500 });
  }
}

export async function schedulesMine() {
  try {
    const session = await requireSession();
    const data = await prisma.schedule.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function scheduleUpdateTitle(req: Request, scheduleId: string) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = updateScheduleTitleSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json({ error: "Invalid request payload", details: firstIssue?.message || "Invalid payload" }, { status: 400 });
    }
    const schedule = await prisma.schedule.findFirst({ where: { id: scheduleId, userId: session.userId }, select: { id: true } });
    if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    const updated = await prisma.schedule.update({ where: { id: scheduleId }, data: { title: parsed.data.title }, select: { id: true, title: true } });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function scheduleDelete(scheduleId: string) {
  try {
    const session = await requireSession();
    const schedule = await prisma.schedule.findFirst({ where: { id: scheduleId, userId: session.userId }, select: { id: true } });
    if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    await prisma.schedule.delete({ where: { id: scheduleId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function scheduleSummary(shareId: string) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cacheKey = `schedule:${shareId}:summary`;
  const cached = await cacheGetJson<any>(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "X-Cache": "HIT" } });

  const schedule = await prisma.schedule.findUnique({
    where: { shareId },
    select: { id: true, title: true, questions: true, daysConfig: true, slotDuration: true, gapMinutes: true, user: { select: { id: true, username: true, phone: true, avatarUrl: true } } },
  });
  if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

  const availableSlots = await prisma.timeSlot.findMany({ where: { scheduleId: schedule.id, isBooked: false, startTime: { gte: new Date() } }, select: { startTime: true } });
  const availableDates = Array.from(new Set(availableSlots.map((s) => formatInTimeZone(s.startTime, "Asia/Tehran", "yyyy-MM-dd"))));
  const payload = { ...schedule, availableDates };
  await cacheSetJson(cacheKey, payload, 30);
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "X-Cache": "MISS" } });
}

export async function scheduleSlots(req: Request, shareId: string) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const schedule = await prisma.schedule.findUnique({ where: { shareId }, select: { id: true } });
  if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

  const cacheKey = `schedule:${shareId}:slots:${date}`;
  const cached = await cacheGetJson<any[]>(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "X-Cache": "HIT" } });

  const slots = await prisma.timeSlot.findMany({ where: { scheduleId: schedule.id, isBooked: false, startTime: { gte: new Date() } }, orderBy: { startTime: "asc" } });
  const filtered = slots.filter((s) => formatInTimeZone(s.startTime, "Asia/Tehran", "yyyy-MM-dd") === date);
  await cacheSetJson(cacheKey, filtered, 30);
  return NextResponse.json(filtered, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "X-Cache": "MISS" } });
}

export async function scheduleBook(req: Request, shareId: string) {
  let session: { userId: string };
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "payload";
    return NextResponse.json({ error: "Invalid request payload", details: `${path}: ${issue?.message || "invalid"}` }, { status: 400 });
  }

  const schedule = await prisma.schedule.findUnique({ where: { shareId }, select: { id: true } });
  if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

  const slot = await prisma.timeSlot.findFirst({ where: { id: parsed.data.timeSlotId, scheduleId: schedule.id }, select: { id: true, startTime: true, endTime: true, isBooked: true } });
  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });

  const now = new Date();
  if (slot.endTime <= now || slot.startTime <= now) return NextResponse.json({ error: "Slot already expired" }, { status: 400 });
  if (slot.isBooked) return NextResponse.json({ error: "Slot already booked" }, { status: 409 });

  const conflicts = await getUserBookingsInRange(session.userId, slot.startTime, slot.endTime);
  const conflict = conflicts.find((b) => rangesOverlap(slot.startTime, slot.endTime, b.timeSlot.startTime, b.timeSlot.endTime));
  if (conflict) return NextResponse.json({ error: "Time conflict", details: `Conflict: ${describeConflict(conflict)}` }, { status: 409 });

  const existing = await prisma.booking.findFirst({ where: { scheduleId: schedule.id, bookedByUserId: session.userId }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "Already booked" }, { status: 409 });

  try {
    const booking = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.timeSlot.updateMany({ where: { id: parsed.data.timeSlotId, scheduleId: schedule.id, isBooked: false }, data: { isBooked: true } });
      if (updated.count === 0) throw new Error("SLOT_TAKEN");
      return tx.booking.create({ data: { timeSlotId: parsed.data.timeSlotId, scheduleId: schedule.id, bookedByUserId: session.userId, visitorName: parsed.data.name, answers: parsed.data.answers } });
    });

    const bookingDetails = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { schedule: { select: { id: true, title: true, userId: true } }, timeSlot: { select: { startTime: true } }, bookedByUser: { select: { username: true, phone: true } } },
    });

    if (bookingDetails) {
      const guestName = bookingDetails.bookedByUser?.username || bookingDetails.bookedByUser?.phone || booking.visitorName || "User";
      const ctx = {
        bookingId: bookingDetails.id,
        scheduleId: bookingDetails.scheduleId,
        scheduleTitle: bookingDetails.schedule?.title,
        hostUserId: bookingDetails.schedule.userId,
        guestUserId: bookingDetails.bookedByUserId,
        guestName,
        slotStartIso: bookingDetails.timeSlot?.startTime?.toISOString?.() || null,
      };
      void notifyBookingCreated(ctx).catch(() => {});
      void scheduleTenMinuteReminderForBooking(ctx).catch(() => {});
      void cacheDelByPattern(`schedule:${shareId}:*`).catch(() => {});
    }

    return NextResponse.json(booking);
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_TAKEN") return NextResponse.json({ error: "Slot already booked" }, { status: 409 });
    return NextResponse.json({ error: "Failed to book slot" }, { status: 500 });
  }
}
