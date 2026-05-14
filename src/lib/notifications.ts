import { prisma } from "@/lib/prisma";
import { sendTextSms } from "@/lib/sms";

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
    await sendTextSms({
      to: hostPhone,
      text: `رزرو جدید برای برنامه «${ctx.scheduleTitle || "برنامه"}» ثبت شد.`,
    });
  }

  if (guestPhone) {
    await sendTextSms({
      to: guestPhone,
      text: `رزرو شما برای برنامه «${ctx.scheduleTitle || "برنامه"}» ثبت شد.`,
    });
  }
}

export async function notifyBookingCanceledByHost(ctx: BookingNotificationContext) {
  const { guestPhone } = await resolvePhones(ctx.hostUserId, ctx.guestUserId);
  if (!guestPhone) return;

  await sendTextSms({
    to: guestPhone,
    text: `رزرو شما برای برنامه «${ctx.scheduleTitle || "برنامه"}» توسط میزبان لغو شد.`,
  });
}

export async function scheduleTenMinuteReminderForBooking(ctx: BookingNotificationContext) {
  void ctx;
  return;
}

export async function cancelScheduledRemindersForBooking(bookingId: string) {
  void bookingId;
  return;
}

export async function smokeTestNotificationModule() {
  await sendTextSms({ to: "00000000000", text: "notification smoke test" });
}
