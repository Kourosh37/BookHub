import { HttpError, errorResponse } from "@/lib/errors";
import { lockUsers } from "@/lib/transaction";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { queueBookingNotifications } from "@/lib/notifications";
import { cacheDelByPattern } from "@/lib/cache";
import { withRequestId } from "@/lib/logger";

function toJalaliDateTime(date: Date) {
  const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date: dateFormatter.format(date), time: timeFormatter.format(date) };
}

export function csvEscape(value: string) {
  if (/^[=+\-@\t\r]/.test(value)) value = "'" + value;
  if (value.includes('"') || value.includes(",") || value.includes("\n"))
    return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function bookingsMy(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const scheduleId = url.searchParams.get("scheduleId");
    const bookings = await prisma.booking.findMany({
      where: {
        schedule: { userId: session.userId },
        ...(scheduleId ? { scheduleId } : {}),
      },
      include: {
        schedule: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                phone: true,
                avatarUrl: true,
              },
            },
          },
        },
        timeSlot: true,
        bookedByUser: {
          select: { id: true, username: true, phone: true, avatarUrl: true },
        },
      },
      orderBy: { timeSlot: { startTime: "asc" } },
    });
    return NextResponse.json(bookings, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function bookingsMine() {
  try {
    const session = await requireSession();
    const bookings = await prisma.booking.findMany({
      where: { bookedByUserId: session.userId },
      include: {
        schedule: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
        timeSlot: true,
      },
      orderBy: { timeSlot: { startTime: "asc" } },
    });
    return NextResponse.json(bookings, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function bookingsExport(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const scheduleId = url.searchParams.get("scheduleId");
    const scheduleIds = scheduleId
      ? scheduleId
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];
    const format = (url.searchParams.get("format") || "csv").toLowerCase();

    const bookings = await prisma.booking.findMany({
      where: {
        schedule: { userId: session.userId },
        ...(scheduleIds.length > 0 ? { scheduleId: { in: scheduleIds } } : {}),
      },
      include: {
        schedule: { select: { title: true } },
        timeSlot: true,
        bookedByUser: { select: { username: true, phone: true } },
      },
      orderBy: { timeSlot: { startTime: "asc" } },
    });

    const header = ["Title", "Booked By", "Phone", "Date", "Time", "Answers"];
    const rows = bookings.map((b) => {
      const { date, time } = toJalaliDateTime(b.timeSlot.startTime);
      const name = b.bookedByUser?.username || b.bookedByUser?.phone || "User";
      const phone = b.bookedByUser?.phone || "";
      const answers = Array.isArray(b.answers) ? b.answers.join(" | ") : "";
      return [b.schedule?.title || "", name, phone, date, time, answers];
    });

    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "xls" || format === "excel") {
      const rowsHtml = [header, ...rows]
        .map(
          (row) =>
            `<tr>${row
              .map(
                (cell) =>
                  `<td>${csvEscape(String(cell ?? ""))
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("");
      const html = `<!doctype html><html><head><meta charset=\"utf-8\"></head><body><table border=\"1\">${rowsHtml}</table></body></html>`;
      return new NextResponse(html, {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename=\"bookings-${stamp}.xls\"`,
        },
      });
    }

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => csvEscape(String(cell ?? ""))).join(","))
      .join("\n");
    return new NextResponse(`\ufeff${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"bookings-${stamp}.csv\"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function cancelBooking(req: Request, bookingId: string) {
  const session = await requireSession();
  const initial = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { schedule: { select: { userId: true } } },
  });
  if (!initial) throw new HttpError(404, "Booking not found");
  if (
    initial.schedule.userId !== session.userId &&
    initial.bookedByUserId !== session.userId
  )
    throw new HttpError(403, "Forbidden");
  const shareId = await prisma.$transaction(
    async (tx) => {
      await lockUsers(tx, [
        initial.schedule.userId,
        ...(initial.bookedByUserId ? [initial.bookedByUserId] : []),
      ]);
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          schedule: {
            include: { user: { select: { username: true, phone: true } } },
          },
          timeSlot: true,
          bookedByUser: { select: { username: true, phone: true } },
        },
      });
      if (!booking) throw new HttpError(404, "Booking not found");
      if (booking.status === "CANCELED") return booking.schedule.shareId;
      if (booking.timeSlot.startTime <= new Date())
        throw new HttpError(400, "Past or ongoing bookings cannot be canceled");
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELED", canceledAt: new Date() },
      });
      await tx.timeSlot.update({
        where: { id: booking.timeSlotId },
        data: { isBooked: false },
      });
      await queueBookingNotifications(
        tx,
        {
          bookingId: booking.id,
          scheduleId: booking.scheduleId,
          scheduleTitle: booking.schedule.title,
          hostUserId: booking.schedule.userId,
          guestUserId: booking.bookedByUserId,
          slotStartIso: booking.timeSlot.startTime.toISOString(),
          hostName:
            booking.schedule.user.username ||
            booking.schedule.user.phone ||
            "میزبان",
          guestName:
            booking.bookedByUser?.username ||
            booking.bookedByUser?.phone ||
            booking.visitorName ||
            "کاربر",
        },
        "canceled",
        session.userId,
      );
      return booking.schedule.shareId;
    },
    { maxWait: 15000, timeout: 20000 },
  );
  await cacheDelByPattern(`schedule:${shareId}:*`);
  withRequestId(req.headers.get("x-request-id")).info(
    { bookingId, userId: session.userId },
    "booking canceled",
  );
  return NextResponse.json({ ok: true });
}
