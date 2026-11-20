import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { scheduleSchema } from "@/lib/validations";
import { HttpError } from "@/lib/errors";

export function generateSlots(
  input: z.infer<typeof scheduleSchema>,
  now = new Date(),
) {
  const days = new Map<string, Array<{ startTime: string; endTime: string }>>();
  const today = formatInTimeZone(now, "Asia/Tehran", "yyyy-MM-dd");
  for (const day of input.daysConfig)
    days.set(day.date, [...(days.get(day.date) || []), ...day.ranges]);
  const slots: Array<{ startTime: Date; endTime: Date }> = [];
  for (const [date, ranges] of days) {
    if (date < today) throw new HttpError(400, "Past dates are not allowed");
    const sorted = [...ranges].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
    for (let i = 0; i < sorted.length; i++) {
      const range = sorted[i];
      if (i && range.startTime < sorted[i - 1].endTime)
        throw new HttpError(400, "Overlapping ranges are not allowed");
      const end = fromZonedTime(
        `${date}T${range.endTime}:00`,
        "Asia/Tehran",
      ).getTime();
      let cursor = fromZonedTime(
        `${date}T${range.startTime}:00`,
        "Asia/Tehran",
      ).getTime();
      while (cursor + input.slotDuration * 60000 <= end) {
        if (cursor > now.getTime())
          slots.push({
            startTime: new Date(cursor),
            endTime: new Date(cursor + input.slotDuration * 60000),
          });
        if (slots.length > 5000)
          throw new HttpError(400, "Too many time slots; split this schedule");
        cursor += (input.slotDuration + input.gapMinutes) * 60000;
      }
    }
  }
  if (!slots.length) throw new HttpError(400, "No future slots generated");
  return {
    slots,
    daysConfig: [...days].map(([date, ranges]) => ({ date, ranges })),
  };
}
