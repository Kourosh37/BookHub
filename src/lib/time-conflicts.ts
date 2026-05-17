import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/prisma";

export function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

export async function getUserBookingsInRange(userId: string, rangeStart: Date, rangeEnd: Date) {
  return prisma.booking.findMany({
    where: {
      OR: [{ bookedByUserId: userId }, { schedule: { userId } }],
      timeSlot: {
        startTime: { lt: rangeEnd },
        endTime: { gt: rangeStart },
      },
    },
    include: {
      timeSlot: true,
      schedule: { select: { title: true } },
    },
  });
}

export function describeConflict(booking: {
  schedule?: { title?: string | null } | null;
  timeSlot: { startTime: Date; endTime: Date };
}) {
  const start = formatInTimeZone(booking.timeSlot.startTime, "Asia/Tehran", "yyyy-MM-dd HH:mm");
  const end = formatInTimeZone(booking.timeSlot.endTime, "Asia/Tehran", "HH:mm");
  const title = booking.schedule?.title || "جلسه";
  return `${title} (${start} تا ${end})`;
}
