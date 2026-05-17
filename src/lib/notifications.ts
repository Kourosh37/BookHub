import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { sendTemplateSms } from "@/lib/sms";

type BookingNotificationContext = {
  bookingId: string;
  scheduleId: string;
  scheduleTitle?: string | null;
  hostUserId: string;
  guestUserId?: string | null;
  guestName?: string | null;
  slotStartIso?: string | null;
};

type ContactInfo = { phone: string | null; name: string };

async function resolveContacts(hostUserId: string, guestUserId?: string | null) {
  const [host, guest] = await Promise.all([
    prisma.user.findUnique({ where: { id: hostUserId }, select: { phone: true, username: true } }),
    guestUserId
      ? prisma.user.findUnique({ where: { id: guestUserId }, select: { phone: true, username: true } })
      : Promise.resolve(null),
  ]);

  const hostInfo: ContactInfo = {
    phone: host?.phone || null,
    name: host?.username || host?.phone || "ارائه‌دهنده",
  };

  const guestInfo: ContactInfo = {
    phone: guest?.phone || null,
    name: guest?.username || guest?.phone || "کاربر",
  };

  return { hostInfo, guestInfo };
}

function parseTemplateId(raw?: string) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function buildSlotParams(slotStartIso?: string | null) {
  if (!slotStartIso) return null;
  const slotDate = new Date(slotStartIso);
  if (Number.isNaN(slotDate.getTime())) return null;
  return {
    date: formatInTimeZone(slotDate, "Asia/Tehran", "yyyy-MM-dd"),
    time: formatInTimeZone(slotDate, "Asia/Tehran", "HH:mm"),
  };
}

function buildParams(data: { title: string; name: string; date: string; time: string }) {
  return [
    { name: "TITLE", value: data.title },
    { name: "NAME", value: data.name },
    { name: "DATE", value: data.date },
    { name: "TIME", value: data.time },
  ];
}

export async function notifyBookingCreated(ctx: BookingNotificationContext) {
  const { hostInfo, guestInfo } = await resolveContacts(ctx.hostUserId, ctx.guestUserId);
  const slotInfo = buildSlotParams(ctx.slotStartIso);
  if (!slotInfo) return;

  const hostTemplateId = parseTemplateId(process.env.SMS_TEMPLATE_BOOKING_CREATED_HOST);
  const guestTemplateId = parseTemplateId(process.env.SMS_TEMPLATE_BOOKING_CREATED_GUEST);
  const title = ctx.scheduleTitle || "برنامه";
  const guestName = ctx.guestName || guestInfo.name || "کاربر";

  if (hostInfo.phone && hostTemplateId) {
    await sendTemplateSms({
      phone: hostInfo.phone,
      templateId: hostTemplateId,
      parameters: buildParams({ title, name: guestName, date: slotInfo.date, time: slotInfo.time }),
    });
  }

  if (guestInfo.phone && guestTemplateId) {
    await sendTemplateSms({
      phone: guestInfo.phone,
      templateId: guestTemplateId,
      parameters: buildParams({ title, name: hostInfo.name, date: slotInfo.date, time: slotInfo.time }),
    });
  }
}

export async function notifyBookingCanceledByHost(ctx: BookingNotificationContext) {
  const { hostInfo, guestInfo } = await resolveContacts(ctx.hostUserId, ctx.guestUserId);
  const slotInfo = buildSlotParams(ctx.slotStartIso);
  const templateId = parseTemplateId(process.env.SMS_TEMPLATE_BOOKING_CANCELED);
  if (!guestInfo.phone || !templateId || !slotInfo) return;
  const title = ctx.scheduleTitle || "برنامه";

  await sendTemplateSms({
    phone: guestInfo.phone,
    templateId,
    parameters: buildParams({ title, name: hostInfo.name, date: slotInfo.date, time: slotInfo.time }),
  });
}

export async function scheduleTenMinuteReminderForBooking(ctx: BookingNotificationContext) {
  const { hostInfo, guestInfo } = await resolveContacts(ctx.hostUserId, ctx.guestUserId);
  const slotInfo = buildSlotParams(ctx.slotStartIso);
  const templateId = parseTemplateId(process.env.SMS_TEMPLATE_BOOKING_REMINDER);
  if (!guestInfo.phone || !templateId || !slotInfo || !ctx.slotStartIso) return;

  const start = new Date(ctx.slotStartIso);
  if (Number.isNaN(start.getTime())) return;
  const minutesToStart = Math.floor((start.getTime() - Date.now()) / 60000);
  if (minutesToStart < 0 || minutesToStart > 10) return;

  const title = ctx.scheduleTitle || "برنامه";
  await sendTemplateSms({
    phone: guestInfo.phone,
    templateId,
    parameters: buildParams({ title, name: hostInfo.name, date: slotInfo.date, time: slotInfo.time }),
  });
}

export async function cancelScheduledRemindersForBooking(bookingId: string) {
  void bookingId;
  return;
}

export async function smokeTestNotificationModule() {
  return;
}
