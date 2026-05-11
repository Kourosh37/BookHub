import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { scheduleSchema } from "@/lib/validations";
import { fromZonedTime } from "date-fns-tz";
import { randomBytes } from "crypto";

type Range = { startTime: string; endTime: string };

type DayInput = { date: string; ranges: Range[] };

function createShareId() {
  return randomBytes(4).toString("hex");
}

function toMinutes(v: string) {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

function validateRanges(ranges: Range[]) {
  const sorted = [...ranges]
    .map((r) => ({ ...r, s: toMinutes(r.startTime), e: toMinutes(r.endTime) }))
    .sort((a, b) => a.s - b.s);

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].e <= sorted[i].s) return "بازه زمانی نامعتبر است.";
    if (i > 0 && sorted[i].s < sorted[i - 1].e) return "تداخل بازه‌های زمانی در یک تاریخ مجاز نیست.";
  }

  return null;
}

function normalizeDays(days: DayInput[]) {
  const map = new Map<string, Range[]>();
  for (const d of days) {
    map.set(d.date, [...(map.get(d.date) || []), ...d.ranges]);
  }
  return Array.from(map.entries()).map(([date, ranges]) => ({ date, ranges }));
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const path = firstIssue?.path?.join(".") || "payload";
      const message = firstIssue?.message || "Invalid payload";
      return NextResponse.json({ error: "داده نامعتبر است", details: `${path}: ${message}` }, { status: 400 });
    }

    const normalizedDays = normalizeDays(parsed.data.daysConfig as DayInput[]);

    for (const day of normalizedDays) {
      const err = validateRanges(day.ranges);
      if (err) return NextResponse.json({ error: `${day.date}: ${err}` }, { status: 400 });
    }

    const schedule = await prisma.schedule.create({
      data: {
        shareId: createShareId(),
        userId: session.userId,
        title: parsed.data.title,
        questions: parsed.data.questions,
        daysConfig: normalizedDays,
        slotDuration: parsed.data.slotDuration,
        gapMinutes: parsed.data.gapMinutes,
      },
    });

    const slots: { startTime: Date; endTime: Date }[] = [];

    for (const day of normalizedDays) {
      const [year, month, date] = day.date.split("-").map(Number);

      for (const range of day.ranges) {
        const [sh, sm] = range.startTime.split(":").map(Number);
        const [eh, em] = range.endTime.split(":").map(Number);

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
