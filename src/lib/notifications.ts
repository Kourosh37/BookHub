import { prisma } from "@/lib/prisma";
import { cancelReminderByBookingId, enqueueNotificationSms, enqueueReminder } from "@/lib/jobs";

type BookingNotificationContext = {
  bookingId: string;
  scheduleId: string;
  scheduleTitle?: string | null;
  hostUserId: string;
  guestUserId?: string | null;
  slotStartIso?: string | null;
};

async function resolvePhones(hostUserId: string, guestUserId?: string | null) {
  const [host, guest] = await Promise.all([
    prisma.user.findUnique({ where: { id: hostUserId }, select: { phone: true } }),
    guestUserId ? prisma.user.findUnique({ where: { id: guestUserId }, select: { phone: true } }) : Promise.resolve(null),
  ]);
  return { hostPhone: host?.phone || null, guestPhone: guest?.phone || null };
}

export async function notifyBookingCreated(ctx: BookingNotificationContext) {
  const { hostPhone, guestPhone } = await resolvePhones(ctx.hostUserId, ctx.guestUserId);

  if (hostPhone) {
    await enqueueNotificationSms({
      to: hostPhone,
      text: `رزرو جدید برای برنامه «${ctx.scheduleTitle || "برنامه"}» ثبت شد.`,
    });
  }

  if (guestPhone) {
    await enqueueNotificationSms({
      to: guestPhone,
      text: `رزرو شما برای برنامه «${ctx.scheduleTitle || "برنامه"}» ثبت شد.`,
    });
  }
}

export async function notifyBookingCanceledByHost(ctx: BookingNotificationContext) {
  const { guestPhone } = await resolvePhones(ctx.hostUserId, ctx.guestUserId);
  if (!guestPhone) return;

  await enqueueNotificationSms({
    to: guestPhone,
    text: `رزرو شما برای برنامه «${ctx.scheduleTitle || "برنامه"}» توسط میزبان لغو شد.`,
  });
}

export async function scheduleTenMinuteReminderForBooking(ctx: BookingNotificationContext) {
  if (!ctx.slotStartIso) return;

  const slotStartMs = new Date(ctx.slotStartIso).getTime();
  if (Number.isNaN(slotStartMs)) return;

  const tenMinutesBefore = new Date(slotStartMs - 10 * 60 * 1000);
  if (tenMinutesBefore.getTime() <= Date.now()) return;

  await enqueueReminder({
    bookingId: ctx.bookingId,
    sendAtIso: tenMinutesBefore.toISOString(),
    audience: "both",
  });
}

export async function cancelScheduledRemindersForBooking(bookingId: string) {
  await cancelReminderByBookingId(bookingId);
}

export async function smokeTestNotificationModule() {
  await enqueueNotificationSms({ to: "00000000000", text: "notification queue smoke test" });
}
