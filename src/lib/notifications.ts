type SmsPayload = {
  to: string;
  text: string;
};

type BookingNotificationContext = {
  bookingId: string;
  scheduleId: string;
  scheduleTitle?: string | null;
  hostUserId: string;
  guestUserId?: string | null;
  slotStartIso?: string | null;
};

async function sendSms(_payload: SmsPayload) {
  // TODO: Implement actual SMS provider integration here.
  // Keep this as a no-op for now so product flow stays stable.
}

async function queueSmsReminderJob(_input: {
  bookingId: string;
  sendAtIso: string;
  audience: "host" | "guest" | "both";
}) {
  // TODO: Persist a reminder job (DB/queue) and run it with a worker/cron.
  // This placeholder intentionally does nothing for now.
}

export async function notifyBookingCreated(_ctx: BookingNotificationContext) {
  // TODO: Resolve phone numbers for host/guest and customize message text.
  // Example:
  // await sendSms({ to: hostPhone, text: "A new booking has been created." });
  // await sendSms({ to: guestPhone, text: "Your booking has been confirmed." });
}

export async function notifyBookingCanceledByHost(_ctx: BookingNotificationContext) {
  // TODO: Resolve guest phone and send cancelation SMS.
  // Example:
  // await sendSms({ to: guestPhone, text: "Your booking was canceled by host." });
}

export async function scheduleTenMinuteReminderForBooking(ctx: BookingNotificationContext) {
  if (!ctx.slotStartIso) return;

  const slotStartMs = new Date(ctx.slotStartIso).getTime();
  if (Number.isNaN(slotStartMs)) return;

  const tenMinutesBefore = new Date(slotStartMs - 10 * 60 * 1000);
  if (tenMinutesBefore.getTime() <= Date.now()) return;

  await queueSmsReminderJob({
    bookingId: ctx.bookingId,
    sendAtIso: tenMinutesBefore.toISOString(),
    audience: "both",
  });
}

export async function cancelScheduledRemindersForBooking(_bookingId: string) {
  // TODO: Delete/disable queued reminder jobs related to this booking.
}

export async function smokeTestNotificationModule() {
  // Helpful hook for future wiring tests.
  await sendSms({ to: "00000000000", text: "sms module placeholder" });
}
