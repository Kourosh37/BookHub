import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookingSchema } from "@/lib/validations";
import { requireSession } from "@/lib/auth";
import { notifyBookingCreated, scheduleTenMinuteReminderForBooking } from "@/lib/notifications";
import { cacheDelByPattern } from "@/lib/cache";

export async function POST(req: Request, { params }: { params: { shareId: string } }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "نیاز به ورود", details: "برای رزرو باید وارد حساب شوید" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "payload";
    return NextResponse.json({ error: "داده نامعتبر است", details: `${path}: ${issue?.message || "invalid"}` }, { status: 400 });
  }

  const schedule = await prisma.schedule.findUnique({ where: { shareId: params.shareId }, select: { id: true } });
  if (!schedule) return NextResponse.json({ error: "برنامه پیدا نشد", details: "لینک رزرو معتبر نیست" }, { status: 404 });

  const existing = await prisma.booking.findFirst({
    where: {
      scheduleId: schedule.id,
      bookedByUserId: session.userId,
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { error: "قبلا رزرو انجام شده است", details: "هر کاربر برای هر برنامه فقط یک نوبت می‌تواند رزرو کند" },
      { status: 409 },
    );
  }

  try {
    const booking = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.timeSlot.updateMany({
        where: { id: parsed.data.timeSlotId, scheduleId: schedule.id, isBooked: false },
        data: { isBooked: true },
      });

      if (updated.count === 0) throw new Error("SLOT_TAKEN");

      return tx.booking.create({
        data: {
          timeSlotId: parsed.data.timeSlotId,
          scheduleId: schedule.id,
          bookedByUserId: session.userId,
          visitorName: parsed.data.name,
          answers: parsed.data.answers,
        },
      });
    });

    const bookingDetails = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        schedule: {
          select: { id: true, title: true, userId: true },
        },
        timeSlot: {
          select: { startTime: true },
        },
      },
    });

    if (bookingDetails) {
      const ctx = {
        bookingId: bookingDetails.id,
        scheduleId: bookingDetails.scheduleId,
        scheduleTitle: bookingDetails.schedule?.title,
        hostUserId: bookingDetails.schedule.userId,
        guestUserId: bookingDetails.bookedByUserId,
        slotStartIso: bookingDetails.timeSlot?.startTime?.toISOString?.() || null,
      };

      void notifyBookingCreated(ctx).catch(() => {});
      void scheduleTenMinuteReminderForBooking(ctx).catch(() => {});
      void cacheDelByPattern(`schedule:${params.shareId}:*`).catch(() => {});
    }

    return NextResponse.json(booking);
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_TAKEN") {
      return NextResponse.json({ error: "این بازه همین الان رزرو شد", details: "لطفاً یک بازه دیگر انتخاب کنید" }, { status: 409 });
    }

    return NextResponse.json({ error: "خطا در ثبت رزرو", details: "لطفاً دوباره تلاش کنید" }, { status: 500 });
  }
}
