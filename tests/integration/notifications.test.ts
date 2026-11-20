import { beforeEach, afterAll, it, expect, vi } from "vitest";
import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  resetDatabase,
  createUser,
  asUser,
  request,
  disconnect,
} from "../helpers/db";
import { makeSchedule, book, mockSms } from "../helpers/fixtures";
import { processNotification } from "@/lib/notifications";
import {
  createNotificationQueue,
  publishOutbox,
  queueConnection,
} from "@/lib/queue";
import { cancelBooking } from "@/services/bookings/bookings-service";
let host: Awaited<ReturnType<typeof createUser>>, guest: typeof host;
beforeEach(async () => {
  await resetDatabase();
  host = await createUser("host", "09111111111");
  guest = await createUser("guest", "09222222222");
});
afterAll(disconnect);
it("persists separate recipients and reminders ten minutes before the slot", async () => {
  const s = await makeSchedule(host);
  await book(s, guest);
  const jobs = await prisma.notificationJob.findMany();
  expect(jobs).toHaveLength(4);
  for (const j of jobs.filter((j) => j.type === "BOOKING_REMINDER"))
    expect(j.runAt.getTime()).toBe(s.slots[0].startTime.getTime() - 600000);
  const q = createNotificationQueue();
  try {
    await publishOutbox(q);
    await publishOutbox(q);
    expect(await q.getJobCounts("delayed", "waiting")).toMatchObject({
      delayed: 2,
      waiting: 2,
    });
  } finally {
    await q.obliterate({ force: true });
    await q.close();
  }
});
it("sends once per recipient under duplicate/concurrent processing", async () => {
  const sms = mockSms(),
    s = await makeSchedule(host);
  await book(s, guest);
  const j = await prisma.notificationJob.findFirstOrThrow({
    where: { type: "BOOKING_CREATED" },
  });
  await Promise.all([processNotification(j.id), processNotification(j.id)]);
  expect(sms).toHaveBeenCalledTimes(1);
  expect(
    (await prisma.notificationJob.findUniqueOrThrow({ where: { id: j.id } }))
      .sentAt,
  ).not.toBeNull();
});
it("records failure, retries successfully, and retains its attempt history", async () => {
  const sms = mockSms();
  sms.mockRejectedValueOnce(new Error("provider offline"));
  const s = await makeSchedule(host);
  await book(s, guest);
  const j = await prisma.notificationJob.findFirstOrThrow({
    where: { type: "BOOKING_CREATED" },
  });
  await expect(processNotification(j.id)).rejects.toThrow();
  expect(
    (await prisma.notificationJob.findUniqueOrThrow({ where: { id: j.id } }))
      .attempts,
  ).toBe(1);
  await processNotification(j.id);
  expect(
    (await prisma.notificationJob.findUniqueOrThrow({ where: { id: j.id } }))
      .attempts,
  ).toBe(2);
});
it("does not send reminders early or after cancellation", async () => {
  const sms = mockSms(),
    s = await makeSchedule(host),
    b = await (await book(s, guest)).json(),
    j = await prisma.notificationJob.findFirstOrThrow({
      where: { type: "BOOKING_REMINDER" },
    });
  await expect(processNotification(j.id)).rejects.toThrow("not due");
  await asUser(host, () => cancelBooking(request({}), b.id));
  await processNotification(j.id);
  expect(sms).not.toHaveBeenCalled();
});
it("rechecks recipient preferences and global settings at delivery time", async () => {
  const sms = mockSms(),
    s = await makeSchedule(host);
  await book(s, guest);
  await prisma.user.update({
    where: { id: guest.id },
    data: { smsPreferences: { bookingCreated: false } },
  });
  const j = await prisma.notificationJob.findFirstOrThrow({
    where: { type: "BOOKING_CREATED", recipientUserId: guest.id },
  });
  await processNotification(j.id);
  expect(sms).not.toHaveBeenCalled();
  await prisma.smsGlobalSetting.upsert({
    where: { id: 1 },
    create: { id: 1, bookingCreatedEnabled: false },
    update: { bookingCreatedEnabled: false },
  });
  const h = await prisma.notificationJob.findFirstOrThrow({
    where: { type: "BOOKING_CREATED", recipientUserId: host.id },
  });
  await processNotification(h.id);
  expect(sms).not.toHaveBeenCalled();
});
it("sends due reminders and skips reminders for expired slots", async () => {
  const sms = mockSms(),
    s = await makeSchedule(host);
  await book(s, guest);
  const j = await prisma.notificationJob.findFirstOrThrow({
    where: { type: "BOOKING_REMINDER" },
  });
  await prisma.notificationJob.update({
    where: { id: j.id },
    data: { runAt: new Date(Date.now() - 1) },
  });
  await processNotification(j.id);
  expect(sms).toHaveBeenCalledTimes(1);
  const expired = await prisma.notificationJob.findFirstOrThrow({
    where: { type: "BOOKING_REMINDER", sentAt: null },
  });
  await prisma.notificationJob.update({
    where: { id: expired.id },
    data: {
      runAt: new Date(Date.now() - 1),
      payload: {
        ...(expired.payload as object),
        slotStartIso: new Date(Date.now() - 60000).toISOString(),
      },
    },
  });
  await processNotification(expired.id);
  expect(sms).toHaveBeenCalledTimes(1);
});
it("retains jobs for recovery if Redis publication fails", async () => {
  const s = await makeSchedule(host);
  await book(s, guest);
  const q = createNotificationQueue();
  const add = vi.spyOn(q, "add").mockRejectedValue(new Error("Redis offline"));
  try {
    await expect(publishOutbox(q)).rejects.toThrow("Redis offline");
    expect(
      await prisma.notificationJob.count({ where: { publishedAt: null } }),
    ).toBe(4);
    add.mockRestore();
    await publishOutbox(q);
    expect(
      await prisma.notificationJob.count({ where: { publishedAt: null } }),
    ).toBe(0);
  } finally {
    await q.obliterate({ force: true });
    await q.close();
  }
});
it("a real BullMQ worker delivers queued messages and survives a restart", async () => {
  const sms = mockSms(),
    s = await makeSchedule(host);
  await book(s, guest);
  const q = createNotificationQueue();
  await publishOutbox(q);
  const worker = new Worker(
    "bookhub-notifications",
    (j) => processNotification(j.data.id),
    { connection: queueConnection(), concurrency: 2 },
  );
  try {
    await vi.waitFor(
      async () =>
        expect(
          await prisma.notificationJob.count({
            where: { type: "BOOKING_CREATED", sentAt: { not: null } },
          }),
        ).toBe(2),
      { timeout: 10000, interval: 50 },
    );
    expect(sms).toHaveBeenCalledTimes(2);
  } finally {
    await worker.close();
    await q.obliterate({ force: true });
    await q.close();
  }
});
