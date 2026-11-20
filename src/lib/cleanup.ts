import { prisma } from "@/lib/prisma";
import { positiveInt } from "@/lib/config";

// Completed and canceled bookings are retained. Only unused slots and security debris expire.
export async function cleanupExpiredBookingsAndSlots(_options?: {
  force?: boolean;
}) {
  const now = Date.now();
  const days = positiveInt(process.env.UNBOOKED_SLOT_RETENTION_DAYS, 30, 3650);
  const otpDays = positiveInt(process.env.OTP_RETENTION_DAYS, 7, 365);
  return prisma.$transaction(async (tx) => {
    const slots = await tx.timeSlot.deleteMany({
      where: {
        endTime: { lt: new Date(now - days * 86400000) },
        bookings: { none: {} },
      },
    });
    const codes = await tx.otpCode.deleteMany({
      where: { expiresAt: { lt: new Date(now - otpDays * 86400000) } },
    });
    await tx.otpAttempt.deleteMany({
      where: {
        lastAttemptAt: { lt: new Date(now - otpDays * 86400000) },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date(now) } }],
      },
    });
    await tx.adminSession.deleteMany({
      where: { expiresAt: { lt: new Date(now) } },
    });
    return { slotsRemoved: slots.count, otpCodesRemoved: codes.count };
  });
}
