import { it, expect, vi } from "vitest";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  apiFetch,
  authMeResponseSchema,
  simpleOkSchema,
} from "@/lib/api-client";
import {
  HttpError,
  readJson,
  parseBody,
  errorResponse,
  handleRoute,
} from "@/lib/errors";
import {
  formatJalaliDate,
  formatJalaliTime,
  formatJalaliDateTime,
  formatDurationFromMinutesFa,
  minutesUntil,
} from "@/lib/date-time";
import { OTP_DELAY_NOTICE } from "@/lib/ui-messages";
it("validates responses and rejects invalid successful payloads", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => Response.json({ ok: true }));
  expect(await apiFetch("/test", undefined, simpleOkSchema)).toEqual({
    ok: true,
  });
  fetch.mockImplementation(async () => Response.json({ user: null }));
  await expect(
    apiFetch("/test", undefined, authMeResponseSchema),
  ).rejects.toThrow();
});
it.each([
  { error: "Error", details: "Details" },
  { error: "Error" },
  {},
  ["bad"],
])("reports API errors safely %j", async (body) => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    Response.json(body, { status: 400 }),
  );
  await expect(apiFetch("/test", undefined, simpleOkSchema)).rejects.toThrow();
});
it("handles non-JSON errors and propagates offline failures", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response("bad", { status: 502 }));
  await expect(apiFetch("/test", undefined, simpleOkSchema)).rejects.toThrow();
  fetch.mockRejectedValue(new Error("offline"));
  await expect(apiFetch("/test", undefined, simpleOkSchema)).rejects.toThrow(
    "offline",
  );
});
it("returns 400 for malformed JSON and 413 for oversized bodies", async () => {
  await expect(
    readJson(new Request("http://localhost", { method: "POST", body: "{" })),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    readJson(
      new Request("http://localhost", {
        method: "POST",
        body: "x".repeat(129 * 1024),
      }),
    ),
  ).rejects.toMatchObject({ status: 413 });
  await expect(
    readJson(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-length": "999999" },
        body: "{}",
      }),
    ),
  ).rejects.toMatchObject({ status: 413 });
  await expect(
    parseBody(
      new Request("http://localhost", { method: "POST", body: "{}" }),
      z.object({ name: z.string() }),
    ),
  ).rejects.toMatchObject({ status: 400 });
});
it("maps expected errors without exposing internal database details", async () => {
  const rate = errorResponse(new HttpError(429, "Rate limit", 5));
  expect(rate.status).toBe(429);
  expect(rate.headers.get("retry-after")).toBe("5");
  const db = errorResponse(
    new Prisma.PrismaClientKnownRequestError("secret SQL", {
      code: "P2002",
      clientVersion: "6",
    }),
  );
  expect(db.status).toBe(409);
  const fail = errorResponse(new Error("secret SQL"));
  expect(fail.status).toBe(500);
  expect(await fail.text()).not.toContain("secret SQL");
  const wrapped = await handleRoute(async () => {
    throw new HttpError(404, "Missing");
  });
  expect(wrapped.status).toBe(404);
  const success = await handleRoute(() => Response.json({ ok: true }));
  expect(success.headers.get("cache-control")).toBe("no-store");
});
it("formats Persian dates, times and durations in Tehran", () => {
  const date = new Date("2027-01-01T06:30Z");
  expect(formatJalaliTime(date)).toContain("۱۰");
  expect(formatJalaliDateTime(date)).toBe(
    formatJalaliDate(date) + " " + formatJalaliTime(date),
  );
  expect(formatDurationFromMinutesFa(1501)).toContain("روز");
  expect(formatDurationFromMinutesFa(61)).toContain("ساعت");
  expect(formatDurationFromMinutesFa(-1)).toContain("۰");
  vi.spyOn(Date, "now").mockReturnValue(date.getTime() - 120000);
  expect(minutesUntil(date)).toBe(2);
  expect(OTP_DELAY_NOTICE.length).toBeGreaterThan(10);
});
