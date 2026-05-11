import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { scheduleSchema } from "@/lib/validations";
import { fromZonedTime } from "date-fns-tz";
import { randomBytes } from "crypto";

function createShareId() {
  return randomBytes(4).toString("hex");
}

function parseHm(v: string) {
  const [h, m] = v.split(":").map(Number);
  return { h, m };
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "داده نامعتبر است" }, { status: 400 });

    const schedule = await prisma.schedule.create({
      data: {
        shareId: createShareId(),
        userId: session.userId,
        title: parsed.data.title,
        questions: parsed.data.questions,
        daysConfig: parsed.data.daysConfig,
        slotDuration: parsed.data.slotDuration,
        gapMinutes: parsed.data.gapMinutes,
      },
    });

    const slots: { startTime: Date; endTime: Date }[] = [];

    for (const day of parsed.data.daysConfig) {
      const [year, month, date] = day.date.split("-").map(Number);
      const { h: sh, m: sm } = parseHm(day.startTime);
      const { h: eh, m: em } = parseHm(day.endTime);

      let cur = new Date(year, month - 1, date, sh, sm, 0);
      const end = new Date(year, month - 1, date, eh, em, 0);

      while (cur < end) {
        const slotEnd = new Date(cur.getTime() + parsed.data.slotDuration * 60000);
        if (slotEnd > end) break;

        slots.push({
          startTime: fromZonedTime(cur, "Asia/Tehran"),
          endTime: fromZonedTime(slotEnd, "Asia/Tehran"),
        });

        cur = new Date(cur.getTime() + (parsed.data.slotDuration + parsed.data.gapMinutes) * 60000);
      }
    }

    if (slots.length) {
      await prisma.timeSlot.createMany({
        data: slots.map((s) => ({ ...s, scheduleId: schedule.id })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ shareId: schedule.shareId });
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}
