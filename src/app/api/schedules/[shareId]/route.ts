import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { shareId: string } }) {
  const schedule = await prisma.schedule.findUnique({
    where: { shareId: params.shareId },
    select: { id: true, title: true, questions: true, daysConfig: true, slotDuration: true, gapMinutes: true },
  });

  if (!schedule) return NextResponse.json({ error: "برنامه پیدا نشد" }, { status: 404 });
  return NextResponse.json(schedule);
}
