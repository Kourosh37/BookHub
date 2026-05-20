import { prisma } from "@/lib/prisma";

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const EXPIRED_RETENTION_MINUTES = 30;

const cleanupGlobal = globalThis as typeof globalThis & {
  __bookhubCleanupLastRunAt?: number;
  __bookhubCleanupRunning?: boolean;
};

export async function cleanupExpiredBookingsAndSlots() {
  const now = Date.now();
  const lastRun = cleanupGlobal.__bookhubCleanupLastRunAt || 0;

  if (cleanupGlobal.__bookhubCleanupRunning) return;
  if (now - lastRun < CLEANUP_INTERVAL_MS) return;

  cleanupGlobal.__bookhubCleanupRunning = true;
  cleanupGlobal.__bookhubCleanupLastRunAt = now;

  try {
    const cutoff = new Date(now - EXPIRED_RETENTION_MINUTES * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      const expiredSlots = await tx.timeSlot.findMany({
        where: {
          endTime: { lt: cutoff },
        },
        select: { id: true },
      });

      if (expiredSlots.length === 0) return;
      const slotIds = expiredSlots.map((s) => s.id);

      await tx.booking.deleteMany({
        where: { timeSlotId: { in: slotIds } },
      });

      await tx.timeSlot.deleteMany({
        where: { id: { in: slotIds } },
      });
    });
  } finally {
    cleanupGlobal.__bookhubCleanupRunning = false;
  }
}

