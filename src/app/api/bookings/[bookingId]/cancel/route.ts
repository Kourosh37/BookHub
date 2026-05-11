import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export async function POST(_: Request, { params }: { params: { bookingId: string } }) {
  try {
    const session = await requireSession();

    const booking = await prisma.booking.findUnique({
      where: { id: params.bookingId },
      include: {
        schedule: {
          select: { userId: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "رزرو پیدا نشد" }, { status: 404 });
    }

    if (booking.schedule.userId !== session.userId) {
      return NextResponse.json({ error: "عدم دسترسی", details: "فقط صاحب برنامه می‌تواند این رزرو را کنسل کند" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.delete({ where: { id: booking.id } });
      await tx.timeSlot.update({
        where: { id: booking.timeSlotId },
        data: { isBooked: false },
      });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}
