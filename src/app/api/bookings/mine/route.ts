import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();

    const now = new Date();
    const bookings = await prisma.booking.findMany({
      where: {
        bookedByUserId: session.userId,
        timeSlot: {
          endTime: { gte: now },
        },
      },
      include: {
        schedule: {
          include: {
            user: {
              select: { phone: true, username: true, avatarUrl: true },
            },
          },
        },
        timeSlot: true,
      },
      orderBy: { timeSlot: { startTime: "asc" } },
    });

    return NextResponse.json(bookings, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}
