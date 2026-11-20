import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  scheduleSchema,
  updateScheduleTitleSchema,
  bookingSchema,
  dateSchema,
  questionSchema,
} from "@/lib/validations";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { randomBytes } from "node:crypto";
import { cacheDelByPattern } from "@/lib/cache";
import { generateSlots } from "@/lib/schedule-slots";
import { queueBookingNotifications } from "@/lib/notifications";
import { HttpError, parseBody } from "@/lib/errors";
import { lockUsers } from "@/lib/transaction";
import { z } from "zod";

const noStore = { "Cache-Control": "no-store" };
export async function schedulesCreate(req: Request) {
  const session = await requireSession();
  const input = await parseBody(req, scheduleSchema);
  const { slots, daysConfig } = generateSlots(input);
  const minStart = new Date(
    Math.min(...slots.map((s) => s.startTime.getTime())),
  );
  const maxEnd = new Date(Math.max(...slots.map((s) => s.endTime.getTime())));
  const schedule = await prisma.$transaction(
    async (tx) => {
      await lockUsers(tx, [session.userId]);
      const bookings = await tx.booking.findMany({
        where: {
          status: "CONFIRMED",
          OR: [
            { bookedByUserId: session.userId },
            { schedule: { userId: session.userId } },
          ],
          timeSlot: { startTime: { lt: maxEnd }, endTime: { gt: minStart } },
        },
        include: { timeSlot: true },
      });
      if (
        slots.some((s) =>
          bookings.some(
            (b) =>
              s.startTime < b.timeSlot.endTime &&
              s.endTime > b.timeSlot.startTime,
          ),
        )
      )
        throw new HttpError(409, "Schedule conflicts with existing sessions");
      return tx.schedule.create({
        data: {
          ...input,
          daysConfig,
          shareId: randomBytes(12).toString("hex"),
          userId: session.userId,
          slots: { createMany: { data: slots } },
        },
      });
    },
    { maxWait: 10000, timeout: 15000 },
  );
  return NextResponse.json(schedule);
}
export async function schedulesMine() {
  const session = await requireSession();
  return NextResponse.json(
    await prisma.schedule.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
    }),
    { headers: noStore },
  );
}
export async function scheduleUpdateTitle(req: Request, scheduleId: string) {
  const session = await requireSession();
  const input = await parseBody(req, updateScheduleTitleSchema);
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, userId: session.userId },
    select: { shareId: true },
  });
  if (!schedule) throw new HttpError(404, "Schedule not found");
  const updated = await prisma.schedule.update({
    where: { id: scheduleId },
    data: input,
    select: { id: true, title: true },
  });
  await cacheDelByPattern(`schedule:${schedule.shareId}:*`);
  return NextResponse.json(updated);
}
export async function scheduleDelete(scheduleId: string) {
  const session = await requireSession();
  const schedule = await prisma.$transaction(async (tx) => {
    await lockUsers(tx, [session.userId]);
    const current = await tx.schedule.findFirst({
      where: { id: scheduleId, userId: session.userId },
      select: { id: true, shareId: true },
    });
    if (!current) throw new HttpError(404, "Schedule not found");
    const bookings = await tx.booking.findMany({
      where: { scheduleId },
      select: { id: true },
    });
    await tx.notificationJob.updateMany({
      where: { bookingId: { in: bookings.map((b) => b.id) }, sentAt: null },
      data: { canceledAt: new Date() },
    });
    await tx.schedule.delete({ where: { id: scheduleId } });
    return current;
  });
  await cacheDelByPattern(`schedule:${schedule.shareId}:*`);
  return NextResponse.json({ ok: true });
}
export async function scheduleSummary(shareId: string) {
  await requireSession();
  // Check existence before the cache so deleted schedules are never served from it.
  const schedule = await prisma.schedule.findUnique({
    where: { shareId },
    select: {
      id: true,
      title: true,
      questions: true,
      daysConfig: true,
      slotDuration: true,
      gapMinutes: true,
      user: {
        select: { id: true, username: true, phone: true, avatarUrl: true },
      },
    },
  });
  if (!schedule) throw new HttpError(404, "Schedule not found");
  const futureSlots = await prisma.timeSlot.findMany({
    where: { scheduleId: schedule.id, startTime: { gt: new Date() } },
    select: { startTime: true, isBooked: true },
    orderBy: { startTime: "asc" },
  });
  const dates = new Map<
    string,
    {
      date: string;
      isFull: boolean;
      availableCount: number;
      totalCount: number;
    }
  >();
  for (const slot of futureSlots) {
    const date = formatInTimeZone(slot.startTime, "Asia/Tehran", "yyyy-MM-dd");
    const row = dates.get(date) || {
      date,
      isFull: true,
      availableCount: 0,
      totalCount: 0,
    };
    row.totalCount++;
    if (!slot.isBooked) {
      row.availableCount++;
      row.isFull = false;
    }
    dates.set(date, row);
  }
  const dateOptions = [...dates.values()];
  return NextResponse.json(
    {
      ...schedule,
      dateOptions,
      availableDates: dateOptions.filter((d) => !d.isFull).map((d) => d.date),
    },
    { headers: noStore },
  );
}
export async function scheduleSlots(req: Request, shareId: string) {
  await requireSession();
  const parsed = dateSchema.safeParse(
    new URL(req.url).searchParams.get("date"),
  );
  if (!parsed.success) throw new HttpError(400, "A valid date is required");
  const schedule = await prisma.schedule.findUnique({
    where: { shareId },
    select: { id: true },
  });
  if (!schedule) throw new HttpError(404, "Schedule not found");
  const start = fromZonedTime(`${parsed.data}T00:00:00`, "Asia/Tehran");
  const end = new Date(start.getTime() + 86400000);
  // Availability is authoritative database state, never a stale cached booking flag.
  const slots = await prisma.timeSlot.findMany({
    where: {
      scheduleId: schedule.id,
      startTime: {
        gt: new Date(Math.max(Date.now(), start.getTime() - 1)),
        lt: end,
      },
    },
    orderBy: { startTime: "asc" },
  });
  return NextResponse.json(slots, { headers: noStore });
}
export async function scheduleBook(req: Request, shareId: string) {
  const session = await requireSession();
  const input = await parseBody(req, bookingSchema);
  const schedule = await prisma.schedule.findUnique({
    where: { shareId },
    select: { id: true, userId: true },
  });
  if (!schedule) throw new HttpError(404, "Schedule not found");
  const booking = await prisma.$transaction(
    async (tx) => {
      // All booking mutations share these sorted participant locks, including host/guest role changes.
      await lockUsers(tx, [session.userId, schedule.userId]);
      const current = await tx.schedule.findUnique({
        where: { id: schedule.id },
        include: { user: { select: { username: true, phone: true } } },
      });
      if (!current) throw new HttpError(404, "Schedule not found");
      const questions = z.array(questionSchema).parse(current.questions);
      if (
        input.answers.length !== questions.length ||
        questions.some((q, i) => q.required && !input.answers[i]?.trim())
      )
        throw new HttpError(400, "Please answer all required questions");
      const slot = await tx.timeSlot.findFirst({
        where: { id: input.timeSlotId, scheduleId: current.id },
      });
      if (!slot) throw new HttpError(404, "Slot not found");
      if (slot.startTime <= new Date())
        throw new HttpError(400, "Slot already expired");
      if (slot.isBooked) throw new HttpError(409, "Slot already booked");
      const participantIds = [...new Set([session.userId, current.userId])];
      const conflict = await tx.booking.findFirst({
        where: {
          status: "CONFIRMED",
          OR: [
            { bookedByUserId: { in: participantIds } },
            { schedule: { userId: { in: participantIds } } },
          ],
          timeSlot: {
            startTime: { lt: slot.endTime },
            endTime: { gt: slot.startTime },
          },
        },
      });
      if (conflict) throw new HttpError(409, "Time conflict");
      if (
        await tx.booking.findFirst({
          where: {
            scheduleId: current.id,
            bookedByUserId: session.userId,
            status: "CONFIRMED",
          },
        })
      )
        throw new HttpError(409, "Already booked");
      const claimed = await tx.timeSlot.updateMany({
        where: { id: slot.id, isBooked: false },
        data: { isBooked: true },
      });
      if (!claimed.count) throw new HttpError(409, "Slot already booked");
      const result = await tx.booking.create({
        data: {
          timeSlotId: slot.id,
          scheduleId: current.id,
          bookedByUserId: session.userId,
          visitorName: input.name,
          answers: input.answers,
        },
      });
      const guest = await tx.user.findUniqueOrThrow({
        where: { id: session.userId },
        select: { username: true, phone: true },
      });
      await queueBookingNotifications(
        tx,
        {
          bookingId: result.id,
          scheduleId: current.id,
          scheduleTitle: current.title,
          hostUserId: current.userId,
          guestUserId: session.userId,
          slotStartIso: slot.startTime.toISOString(),
          guestName: guest.username || guest.phone || "کاربر",
          hostName: current.user.username || current.user.phone || "میزبان",
        },
        "created",
      );
      return result;
    },
    { maxWait: 15000, timeout: 20000 },
  );
  await cacheDelByPattern(`schedule:${shareId}:*`);
  return NextResponse.json(booking);
}
