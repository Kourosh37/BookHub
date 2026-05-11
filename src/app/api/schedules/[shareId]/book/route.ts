import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookingSchema } from "@/lib/validations";

export async function POST(req: Request, { params }: { params: { shareId: string } }) {
  const body = await req.json();
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const schedule = await prisma.schedule.findUnique({ where: { shareId: params.shareId }, select: { id: true } });
  if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

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
          visitorName: parsed.data.name,
          answers: parsed.data.answers,
        },
      });
    });

    return NextResponse.json(booking);
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_TAKEN") {
      return NextResponse.json({ error: "This slot was just taken, please choose another." }, { status: 409 });
    }

    return NextResponse.json({ error: "Booking failed" }, { status: 500 });
  }
}
