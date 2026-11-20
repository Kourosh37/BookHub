import { it, expect, vi } from "vitest";
vi.mock("@/lib/auth", () => ({
  requireSession: async () => ({ userId: "user", phone: "09123456789" }),
  getSession: async () => ({ userId: "user", phone: "09123456789" }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    schedule: {
      findMany: vi
        .fn()
        .mockRejectedValue(new Error("private database failure")),
    },
    booking: {
      findMany: vi
        .fn()
        .mockRejectedValue(new Error("private database failure")),
    },
    user: {
      findUniqueOrThrow: vi
        .fn()
        .mockRejectedValue(new Error("private database failure")),
    },
  },
}));
it("maps infrastructure failures to 500 rather than falsely reporting unauthorized", async () => {
  const schedule = await import("@/app/api/schedules/my/route");
  const response = await schedule.GET();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private");
  const booking = await import("@/app/api/bookings/my/route");
  expect((await booking.GET(new Request("http://localhost"))).status).toBe(500);
  const profile = await import("@/app/api/profile/route");
  expect((await profile.GET()).status).toBe(500);
});
