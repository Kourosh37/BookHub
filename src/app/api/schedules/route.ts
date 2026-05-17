import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { scheduleSchema } from "@/lib/validations";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { randomBytes } from "crypto";
import { cacheDelByPattern } from "@/lib/cache";
import { describeConflict, getUserBookingsInRange, rangesOverlap } from "@/lib/time-conflicts";

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
  let session: { userId: string } | null = null;
  try {
    session = await requireSession();
    const body = await req.json();
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const path = firstIssue?.path?.join(".") || "payload";
      const message = firstIssue?.message || "Invalid payload";
      return NextResponse.json({ error: "داده نامعتبر است", details: `${path}: ${message}` }, { status: 400 });
    }

    const normalizedDays = normalizeDays(parsed.data.daysConfig as DayInput[]);
    const todayInTehran = formatInTimeZone(new Date(), "Asia/Tehran", "yyyy-MM-dd");

    for (const day of normalizedDays) {
      if (day.date < todayInTehran) {
        return NextResponse.json(
          { error: `تاریخ ${day.date} گذشته است`, details: "تاریخ برنامه نباید قبل از تاریخ امروز باشد" },
          { status: 400 },
        );
      }
    }

    for (const day of normalizedDays) {
      const err = validateRanges(day.ranges);
      if (err) return NextResponse.json({ error: `${day.date}: ${err}` }, { status: 400 });
    }

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

    if (!slots.length) {
      return NextResponse.json(
        {
          error: "بازه قابل رزرو تولید نشد",
          details: "بازه‌های واردشده با مدت جلسه سازگار نیست یا خیلی کوتاه است.",
        },
        { status: 400 },
      );
    }

    if (slots.length) {
      const minStart = new Date(Math.min(...slots.map((s) => s.startTime.getTime())));
      const maxEnd = new Date(Math.max(...slots.map((s) => s.endTime.getTime())));
      const existing = await getUserBookingsInRange(session.userId, minStart, maxEnd);

      const conflicting = slots.find((slot) =>
        existing.some((b) => rangesOverlap(slot.startTime, slot.endTime, b.timeSlot.startTime, b.timeSlot.endTime)),
      );

      if (conflicting) {
        const hit = existing.find((b) =>
          rangesOverlap(conflicting.startTime, conflicting.endTime, b.timeSlot.startTime, b.timeSlot.endTime),
        );

        return NextResponse.json(
          {
            error: "تداخل زمانی با جلسات موجود",
            details: hit ? `بازه انتخابی با ${describeConflict(hit)} همپوشانی دارد.` : "بازه انتخابی با جلسات موجود همپوشانی دارد.",
          },
          { status: 409 },
        );
      }
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

    if (slots.length) {
      await prisma.timeSlot.createMany({
        data: slots.map((s) => ({ ...s, scheduleId: schedule.id })),
        skipDuplicates: true,
      });
    }

    void cacheDelByPattern(`schedule:${schedule.shareId}:*`).catch(() => {});

    return NextResponse.json({
      id: schedule.id,
      shareId: schedule.shareId,
      title: schedule.title,
      createdAt: schedule.createdAt,
    });

  } catch (error: any) {
    if (!session) {
      return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "خطا در ساخت برنامه", details: error?.message || "خطای ناشناخته در پردازش فرم" },
      { status: 500 },
    );
  }
}
