import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { cancelScheduledRemindersForBooking, notifyBookingCanceledByHost } from "@/lib/notifications";
import { cacheDelByPattern } from "@/lib/cache";
import { withRequestId } from "@/lib/logger";

export async function POST(req: Request, { params }: { params: { bookingId: string } }) {
  const log = withRequestId(req.headers.get("x-request-id"));
  try {
    const session = await requireSession();

    const booking = await prisma.booking.findUnique({
      where: { id: params.bookingId },
      include: {
        schedule: {
          select: { userId: true, title: true, shareId: true },
        },
      },
    });

    if (!booking) {
      log.warn({ bookingId: params.bookingId, userId: session.userId }, "booking not found for cancel");
      return NextResponse.json({ error: "رزرو پیدا نشد" }, { status: 404 });
    }

    if (booking.schedule.userId !== session.userId) {
      log.warn({ bookingId: params.bookingId, userId: session.userId }, "forbidden booking cancel");
      return NextResponse.json({ error: "عدم دسترسی", details: "فقط صاحب برنامه می‌تواند این رزرو را کنسل کند" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.delete({ where: { id: booking.id } });
      await tx.timeSlot.update({
        where: { id: booking.timeSlotId },
        data: { isBooked: false },
      });
    });

    void notifyBookingCanceledByHost({
      bookingId: booking.id,
      scheduleId: booking.scheduleId,
      scheduleTitle: booking.schedule.title,
      hostUserId: booking.schedule.userId,
      guestUserId: booking.bookedByUserId,
    }).catch(() => {});
    void cancelScheduledRemindersForBooking(booking.id).catch(() => {});
    void cacheDelByPattern(`schedule:${booking.schedule.shareId}:*`).catch(() => {});

    log.info({ bookingId: booking.id, userId: session.userId }, "booking canceled");
    return NextResponse.json({ ok: true });
  } catch {
    log.error({ bookingId: params.bookingId }, "booking cancel unauthorized");
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}
