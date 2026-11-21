import { beforeEach, afterAll, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  resetDatabase,
  createUser,
  asUser,
  request,
  disconnect,
} from "../helpers/db";
import {
  makeSchedule,
  book,
  scheduleInput,
  futureDate,
} from "../helpers/fixtures";
import * as schedules from "@/services/schedules/schedules-service";
import * as bookings from "@/services/bookings/bookings-service";
import { cleanupExpiredBookingsAndSlots } from "@/lib/cleanup";
import { getUserBookingsInRange, describeConflict } from "@/lib/time-conflicts";
let host: Awaited<ReturnType<typeof createUser>>,
  guest: typeof host,
  other: typeof host;
beforeEach(async () => {
  await resetDatabase();
  host = await createUser("host", "09111111111");
  guest = await createUser("guest", "09222222222");
  other = await createUser("other", "09333333333");
});
afterAll(disconnect);
it("creates a schedule and all slots atomically in Tehran time", async () => {
  const s = await makeSchedule(host);
  expect(s.slots).toHaveLength(3);
  expect(s.slots[0].startTime.toISOString()).toContain("T06:30:");
  expect((await asUser(host, schedules.schedulesMine)).status).toBe(200);
  await expect(
    asUser(host, () =>
      schedules.schedulesCreate(request(scheduleInput({ slotDuration: 5.5 }))),
    ),
  ).rejects.toMatchObject({ status: 400 });
  expect(await prisma.schedule.count()).toBe(1);
});
it("rolls back the actual service when PostgreSQL rejects slot insertion", async () => {
  await prisma.$executeRawUnsafe(
    "CREATE FUNCTION bookhub_test_fail_slot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected slot failure'; END; $$",
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER bookhub_test_fail_slot BEFORE INSERT ON "TimeSlot" FOR EACH ROW EXECUTE FUNCTION bookhub_test_fail_slot()',
  );
  try {
    await expect(makeSchedule(host)).rejects.toThrow();
    expect(await prisma.schedule.count()).toBe(0);
    expect(await prisma.timeSlot.count()).toBe(0);
  } finally {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS bookhub_test_fail_slot ON "TimeSlot"',
    );
    await prisma.$executeRawUnsafe(
      "DROP FUNCTION IF EXISTS bookhub_test_fail_slot()",
    );
  }
});

it("requires authentication, ownership and valid query dates", async () => {
  await expect(schedules.schedulesMine()).rejects.toMatchObject({
    status: 401,
  });
  const s = await makeSchedule(host);
  await expect(
    asUser(guest, () =>
      schedules.scheduleUpdateTitle(request({ title: "Changed" }), s.id),
    ),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    asUser(guest, () => schedules.scheduleDelete(s.id)),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    asUser(guest, () =>
      schedules.scheduleSlots(
        new Request("http://localhost?date=2027-02-31"),
        s.shareId,
      ),
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    asUser(guest, () => schedules.scheduleSummary("missing")),
  ).rejects.toMatchObject({ status: 404 });
});
it("returns fresh availability and title after mutations", async () => {
  const s = await makeSchedule(host),
    b = await (await book(s, guest)).json();
  let summary = await (
    await asUser(guest, () => schedules.scheduleSummary(s.shareId))
  ).json();
  expect(summary.dateOptions[0].availableCount).toBe(2);
  await asUser(host, () =>
    schedules.scheduleUpdateTitle(request({ title: "Updated title" }), s.id),
  );
  summary = await (
    await asUser(guest, () => schedules.scheduleSummary(s.shareId))
  ).json();
  expect(summary.title).toBe("Updated title");
  const slots = await (
    await asUser(guest, () =>
      schedules.scheduleSlots(
        new Request("http://localhost?date=" + futureDate()),
        s.shareId,
      ),
    )
  ).json();
  expect(
    slots.find((x: { id: string }) => x.id === s.slots[0].id).isBooked,
  ).toBe(true);
  await asUser(guest, () => bookings.cancelBooking(request({}), b.id));
  summary = await (
    await asUser(guest, () => schedules.scheduleSummary(s.shareId))
  ).json();
  expect(summary.dateOptions[0].availableCount).toBe(3);
});
it("two people racing one slot produce exactly one confirmed booking", async () => {
  const s = await makeSchedule(host),
    results = await Promise.allSettled([book(s, guest), book(s, other)]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    (results.find((r) => r.status === "rejected") as PromiseRejectedResult)
      .reason.status,
  ).toBe(409);
  expect(await prisma.booking.count()).toBe(1);
  expect(await prisma.notificationJob.count()).toBe(4);
});
it("handles heavier contention without double booking", async () => {
  const s = await makeSchedule(host),
    users = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        createUser("race" + i, "0940000000" + i),
      ),
    );
  expect(
    (await Promise.allSettled(users.map((u) => book(s, u)))).filter(
      (r) => r.status === "fulfilled",
    ),
  ).toHaveLength(1);
  expect(await prisma.booking.count()).toBe(1);
});
it("one guest cannot race different slots in one schedule", async () => {
  const s = await makeSchedule(host);
  expect(
    (await Promise.allSettled([book(s, guest, 0), book(s, guest, 1)])).filter(
      (r) => r.status === "fulfilled",
    ),
  ).toHaveLength(1);
  expect(await prisma.timeSlot.count({ where: { isBooked: true } })).toBe(1);
});
it("serializes overlapping bookings across separate schedules sharing a host", async () => {
  const a = await makeSchedule(host),
    b = await makeSchedule(host);
  expect(
    (await Promise.allSettled([book(a, guest), book(b, other)])).filter(
      (r) => r.status === "fulfilled",
    ),
  ).toHaveLength(1);
});
it("serializes overlapping bookings across separate hosts sharing a guest", async () => {
  const a = await makeSchedule(host),
    b = await makeSchedule(other);
  expect(
    (await Promise.allSettled([book(a, guest), book(b, guest)])).filter(
      (r) => r.status === "fulfilled",
    ),
  ).toHaveLength(1);
});
it("checks users switching between host and guest roles", async () => {
  const a = await makeSchedule(host),
    b = await makeSchedule(guest);
  expect(
    (await Promise.allSettled([book(a, guest), book(b, other)])).filter(
      (r) => r.status === "fulfilled",
    ),
  ).toHaveLength(1);
});
it("validates required answers, slot ownership and expiration", async () => {
  const s = await makeSchedule(host, {
      questions: [{ label: "Name", type: "text", required: true }],
    }),
    alien = await makeSchedule(other);
  await expect(book(s, guest)).rejects.toMatchObject({ status: 400 });
  await expect(book(s, guest, 0, [" "])).rejects.toMatchObject({ status: 400 });
  await expect(
    asUser(guest, () =>
      schedules.scheduleBook(
        request({ timeSlotId: alien.slots[0].id, answers: ["Answer"] }),
        s.shareId,
      ),
    ),
  ).rejects.toMatchObject({ status: 404 });
  await prisma.timeSlot.update({
    where: { id: s.slots[0].id },
    data: {
      startTime: new Date(Date.now() - 120000),
      endTime: new Date(Date.now() - 60000),
    },
  });
  await expect(book(s, guest, 0, ["Answer"])).rejects.toMatchObject({
    status: 400,
  });
  expect((await book(s, guest, 1, ["Answer"])).status).toBe(200);
});
it("cancels idempotently, retains history, and allows rebooking", async () => {
  const s = await makeSchedule(host),
    b = await (await book(s, guest)).json();
  await expect(
    asUser(other, () => bookings.cancelBooking(request({}), b.id)),
  ).rejects.toMatchObject({ status: 403 });
  await Promise.all([
    asUser(host, () => bookings.cancelBooking(request({}), b.id)),
    asUser(guest, () => bookings.cancelBooking(request({}), b.id)),
  ]);
  expect(
    (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status,
  ).toBe("CANCELED");
  expect((await book(s, guest)).status).toBe(200);
  expect(await prisma.booking.count()).toBe(2);
  expect(
    await prisma.notificationJob.count({
      where: {
        bookingId: b.id,
        type: "BOOKING_REMINDER",
        canceledAt: { not: null },
      },
    }),
  ).toBe(2);
});
it("deletes populated schedules and cancels their pending notifications", async () => {
  const s = await makeSchedule(host);
  await book(s, guest);
  await asUser(host, () => schedules.scheduleDelete(s.id));
  expect(await prisma.schedule.count()).toBe(0);
  expect(await prisma.booking.count()).toBe(0);
  expect(
    await prisma.notificationJob.count({ where: { canceledAt: null } }),
  ).toBe(0);
});
it("rejects creating a schedule over confirmed sessions", async () => {
  const s = await makeSchedule(host);
  await book(s, guest);
  await expect(makeSchedule(host)).rejects.toMatchObject({ status: 409 });
  await expect(makeSchedule(guest)).rejects.toMatchObject({ status: 409 });
  const conflicts = await getUserBookingsInRange(
    guest.id,
    s.slots[0].startTime,
    s.slots[0].endTime,
  );
  expect(conflicts).toHaveLength(1);
  expect(describeConflict(conflicts[0])).toContain("Test Schedule");
});
it("retains completed bookings and removes only old unused slots", async () => {
  // Distinct slots must stay distinct even when the clock does not advance.
  vi.spyOn(Date, "now").mockReturnValue(Date.now());
  const s = await makeSchedule(host),
    b = await (await book(s, guest)).json();
  const ageMs = 60 * 86400000;
  for (const slot of s.slots.slice(0, 2))
    await prisma.timeSlot.update({
      where: { id: slot.id },
      data: {
        startTime: new Date(slot.startTime.getTime() - ageMs),
        endTime: new Date(slot.endTime.getTime() - ageMs),
      },
    });
  const result = await cleanupExpiredBookingsAndSlots();
  expect(result.slotsRemoved).toBe(1);
  expect(
    await prisma.booking.findUnique({ where: { id: b.id } }),
  ).not.toBeNull();
  expect(
    await prisma.timeSlot.findUnique({ where: { id: s.slots[1].id } }),
  ).toBeNull();
  expect(
    await prisma.timeSlot.findUnique({ where: { id: s.slots[2].id } }),
  ).not.toBeNull();
  expect(
    await (
      await asUser(host, () =>
        bookings.bookingsMy(new Request("http://localhost")),
      )
    ).json(),
  ).toHaveLength(1);
  expect(
    await (await asUser(guest, bookings.bookingsMine)).json(),
  ).toHaveLength(1);
  await expect(
    asUser(guest, () => bookings.cancelBooking(request({}), b.id)),
  ).rejects.toMatchObject({ status: 400 });
});
it.each([
  ["", "csv", "text/csv"],
  ["csv", "csv", "text/csv"],
  ["xls", "xls", "application/vnd.ms-excel"],
  ["excel", "xls", "application/vnd.ms-excel"],
])(
  "returns a valid attachment for export format '%s'",
  async (format, extension, mime) => {
    const response = await asUser(host, () =>
      bookings.bookingsExport(
        new Request(`http://localhost${format ? `?format=${format}` : ""}`),
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(mime);
    const disposition = response.headers.get("content-disposition");
    expect(disposition).toMatch(
      /^attachment; filename="bookings-\d{4}-\d{2}-\d{2}\.(csv|xls)"$/,
    );
    expect(disposition).toContain(`.${extension}"`);
    if (extension === "xls") {
      const html = await response.text();
      expect(html).toContain('<meta charset="utf-8">');
      expect(html).toContain('<table border="1">');
    }
  },
);

it("exports CSV/Excel safely and scopes results to the host", async () => {
  const s = await makeSchedule(host, { title: "=DANGEROUS()" });
  await book(s, guest);
  expect(
    await (
      await asUser(host, () =>
        bookings.bookingsExport(new Request("http://localhost?format=csv")),
      )
    ).text(),
  ).toContain("'=DANGEROUS()");
  expect(
    (
      await asUser(host, () =>
        bookings.bookingsExport(
          new Request("http://localhost?format=xls&scheduleId=" + s.id),
        ),
      )
    ).headers.get("content-type"),
  ).toContain("ms-excel");
  expect(
    await (
      await asUser(other, () =>
        bookings.bookingsExport(new Request("http://localhost")),
      )
    ).text(),
  ).not.toContain("DANGEROUS");
});

it("database constraints reject duplicate active reservations independently of application locks", async () => {
  const s = await makeSchedule(host);
  await prisma.booking.create({
    data: {
      scheduleId: s.id,
      timeSlotId: s.slots[0].id,
      bookedByUserId: guest.id,
      answers: [],
    },
  });
  await expect(
    prisma.booking.create({
      data: {
        scheduleId: s.id,
        timeSlotId: s.slots[0].id,
        bookedByUserId: other.id,
        answers: [],
      },
    }),
  ).rejects.toMatchObject({ code: "P2002" });
  await expect(
    prisma.booking.create({
      data: {
        scheduleId: s.id,
        timeSlotId: s.slots[1].id,
        bookedByUserId: guest.id,
        answers: [],
      },
    }),
  ).rejects.toMatchObject({ code: "P2002" });
  await prisma.booking.updateMany({
    data: { status: "CANCELED", canceledAt: new Date() },
  });
  await expect(
    prisma.booking.create({
      data: {
        scheduleId: s.id,
        timeSlotId: s.slots[0].id,
        bookedByUserId: guest.id,
        answers: [],
      },
    }),
  ).resolves.toBeDefined();
});
