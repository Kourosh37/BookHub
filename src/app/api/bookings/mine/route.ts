import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();

    const bookings = await prisma.booking.findMany({
      where: { bookedByUserId: session.userId },
      include: {
        schedule: {
          include: {
            user: {
              select: { username: true },
            },
          },
        },
        timeSlot: true,
      },
      orderBy: { bookedAt: "desc" },
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
