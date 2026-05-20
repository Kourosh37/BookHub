import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { cancelScheduledRemindersForBooking, notifyBookingCanceledByHost } from "@/lib/notifications";
import { cacheDelByPattern } from "@/lib/cache";
import { withRequestId } from "@/lib/logger";

function toJalaliDateTime(date: Date) {
  const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" });
  const timeFormatter = new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hour12: false });
  return { date: dateFormatter.format(date), time: timeFormatter.format(date) };
}

function csvEscape(value: string) {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function bookingsMy(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const scheduleId = url.searchParams.get("scheduleId");
    const bookings = await prisma.booking.findMany({
      where: { schedule: { userId: session.userId }, ...(scheduleId ? { scheduleId } : {}) },
      include: {
        schedule: { include: { user: { select: { id: true, username: true, phone: true, avatarUrl: true } } } },
        timeSlot: true,
        bookedByUser: { select: { id: true, username: true, phone: true, avatarUrl: true } },
      },
      orderBy: { timeSlot: { startTime: "asc" } },
    });
    return NextResponse.json(bookings, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function bookingsMine() {
  try {
    const session = await requireSession();
    const bookings = await prisma.booking.findMany({
      where: { bookedByUserId: session.userId },
      include: { schedule: { include: { user: { select: { phone: true, username: true, avatarUrl: true } } } }, timeSlot: true },
      orderBy: { timeSlot: { startTime: "asc" } },
    });
    return NextResponse.json(bookings, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function bookingsExport(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const scheduleId = url.searchParams.get("scheduleId");
    const scheduleIds = scheduleId ? scheduleId.split(",").map((id) => id.trim()).filter(Boolean) : [];
    const format = (url.searchParams.get("format") || "csv").toLowerCase();

    const bookings = await prisma.booking.findMany({
      where: { schedule: { userId: session.userId }, ...(scheduleIds.length > 0 ? { scheduleId: { in: scheduleIds } } : {}) },
      include: { schedule: { select: { title: true } }, timeSlot: true, bookedByUser: { select: { username: true, phone: true } } },
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
      const rowsHtml = [header, ...rows].map((row) => `<tr>${row.map((cell) => `<td>${String(cell ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`).join("")}</tr>`).join("");
      const html = `<!doctype html><html><head><meta charset=\"utf-8\"></head><body><table border=\"1\">${rowsHtml}</table></body></html>`;
      return new NextResponse(html, { headers: { "Content-Type": "application/vnd.ms-excel; charset=utf-8", "Content-Disposition": `attachment; filename=\"bookings-${stamp}.xls\"` } });
    }

    const csv = [header, ...rows].map((row) => row.map((cell) => csvEscape(String(cell ?? ""))).join(",")).join("\n");
    return new NextResponse(`\ufeff${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename=\"bookings-${stamp}.csv\"` } });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function cancelBooking(req: Request, bookingId: string) {
  const log = withRequestId(req.headers.get("x-request-id"));
  try {
    const session = await requireSession();
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { schedule: { select: { userId: true, title: true, shareId: true } }, timeSlot: { select: { startTime: true } } },
    });

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    const isHost = booking.schedule.userId === session.userId;
    const isGuest = booking.bookedByUserId === session.userId;
    if (!isHost && !isGuest) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.$transaction(async (tx) => {
      await tx.booking.delete({ where: { id: booking.id } });
      await tx.timeSlot.update({ where: { id: booking.timeSlotId }, data: { isBooked: false } });
    });

    if (isHost) {
      void notifyBookingCanceledByHost({
        bookingId: booking.id,
        scheduleId: booking.scheduleId,
        scheduleTitle: booking.schedule.title,
        hostUserId: booking.schedule.userId,
        guestUserId: booking.bookedByUserId,
        slotStartIso: booking.timeSlot?.startTime?.toISOString?.() || null,
      }).catch(() => {});
    }
    void cancelScheduledRemindersForBooking(booking.id).catch(() => {});
    void cacheDelByPattern(`schedule:${booking.schedule.shareId}:*`).catch(() => {});
    log.info({ bookingId: booking.id, userId: session.userId }, "booking canceled");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
