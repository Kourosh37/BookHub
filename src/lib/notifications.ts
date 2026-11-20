import { Prisma, SmsLogType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendTemplateSms } from "@/lib/sms";
import { isSmsEnabled } from "@/lib/sms-preferences";
import { getSmsGlobalSettings } from "@/lib/admin-sms-settings";

export type BookingNotificationContext = {
  bookingId: string;
  scheduleId: string;
  scheduleTitle: string;
  hostUserId: string;
  guestUserId: string | null;
  slotStartIso: string;
  guestName: string;
  hostName: string;
};
const contextSchema = z.object({
  bookingId: z.string(),
  scheduleId: z.string(),
  scheduleTitle: z.string(),
  hostUserId: z.string(),
  guestUserId: z.string().nullable(),
  slotStartIso: z.iso.datetime(),
  guestName: z.string(),
  hostName: z.string(),
  role: z.enum(["host", "guest"]),
});

export async function queueBookingNotifications(
  tx: Prisma.TransactionClient,
  ctx: BookingNotificationContext,
  event: "created" | "canceled",
  actorId?: string,
) {
  const now = new Date();
  if (event === "canceled")
    await tx.notificationJob.updateMany({
      where: { bookingId: ctx.bookingId, sentAt: null, canceledAt: null },
      data: { canceledAt: now },
    });
  for (const role of ["host", "guest"] as const) {
    const recipientUserId = role === "host" ? ctx.hostUserId : ctx.guestUserId;
    if (
      !recipientUserId ||
      (event === "canceled" && recipientUserId === actorId)
    )
      continue;
    const types: SmsLogType[] =
      event === "created"
        ? ["BOOKING_CREATED", "BOOKING_REMINDER"]
        : ["BOOKING_CANCELED"];
    for (const type of types) {
      const runAt =
        type === "BOOKING_REMINDER"
          ? new Date(
              Math.max(
                now.getTime(),
                new Date(ctx.slotStartIso).getTime() - 10 * 60000,
              ),
            )
          : now;
      await tx.notificationJob.create({
        data: {
          key: `${ctx.bookingId}-${type}-${role}`,
          type,
          bookingId: ctx.bookingId,
          recipientUserId,
          payload: { ...ctx, role },
          runAt,
        },
      });
    }
  }
}

export async function processNotification(jobId: string) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`notification:${jobId}`}, 0))`;
        const job = await tx.notificationJob.findUnique({
          where: { id: jobId },
        });
        if (!job || job.sentAt || job.canceledAt) return;
        if (job.runAt > new Date()) throw new Error("Notification is not due");
        const ctx = contextSchema.parse(job.payload);
        const [user, settings, booking] = await Promise.all([
          tx.user.findUnique({
            where: { id: job.recipientUserId },
            select: { phone: true, smsPreferences: true },
          }),
          getSmsGlobalSettings(),
          job.type === "BOOKING_CANCELED"
            ? Promise.resolve(null)
            : tx.booking.findUnique({
                where: { id: job.bookingId },
                select: { status: true },
              }),
        ]);
        const preference =
          job.type === "BOOKING_REMINDER"
            ? "bookingReminder"
            : job.type === "BOOKING_CANCELED"
              ? "bookingCanceled"
              : "bookingCreated";
        const enabled =
          job.type === "BOOKING_REMINDER"
            ? settings.bookingReminderEnabled
            : job.type === "BOOKING_CANCELED"
              ? settings.bookingCanceledEnabled
              : settings.bookingCreatedEnabled;
        if (
          !user?.phone ||
          !enabled ||
          !isSmsEnabled(user.smsPreferences, preference) ||
          (job.type !== "BOOKING_CANCELED" &&
            booking?.status !== "CONFIRMED") ||
          (job.type === "BOOKING_REMINDER" &&
            new Date(ctx.slotStartIso) <= new Date())
        ) {
          await tx.notificationJob.update({
            where: { id: job.id },
            data: {
              canceledAt: new Date(),
              lastError:
                "Skipped: canceled, expired, disabled, or recipient removed",
            },
          });
          return;
        }
        const templateKey =
          job.type === "BOOKING_CREATED"
            ? `SMS_TEMPLATE_BOOKING_CREATED_${ctx.role.toUpperCase()}`
            : `SMS_TEMPLATE_${job.type}`;
        const templateId = Number(process.env[templateKey]);
        if (!Number.isSafeInteger(templateId) || templateId < 1)
          throw new Error(`Missing SMS template: ${templateKey}`);
        const slot = new Date(ctx.slotStartIso);
        await sendTemplateSms({
          phone: user.phone,
          templateId,
          smsType: job.type,
          parameters: [
            { name: "TITLE", value: ctx.scheduleTitle },
            {
              name: "NAME",
              value: ctx.role === "host" ? ctx.guestName : ctx.hostName,
            },
            {
              name: "DATE",
              value: new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
                timeZone: "Asia/Tehran",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(slot),
            },
            {
              name: "TIME",
              value: new Intl.DateTimeFormat("fa-IR", {
                timeZone: "Asia/Tehran",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(slot),
            },
          ],
        });
        await tx.notificationJob.update({
          where: { id: job.id },
          data: {
            sentAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        });
      },
      { timeout: 30000, maxWait: 10000 },
    );
  } catch (error) {
    await prisma.notificationJob.updateMany({
      where: { id: jobId, sentAt: null, canceledAt: null },
      data: {
        attempts: { increment: 1 },
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
