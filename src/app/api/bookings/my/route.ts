import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const scheduleId = url.searchParams.get("scheduleId");

    const bookings = await prisma.booking.findMany({
      where: {
        schedule: {
          userId: session.userId,
        },
        ...(scheduleId ? { scheduleId } : {}),
      },
      include: {
        schedule: true,
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
