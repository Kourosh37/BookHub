import { describe, it, expect, vi } from "vitest";
import {
  phoneSchema,
  scheduleSchema,
  bookingSchema,
  requestOtpSchema,
  changePasswordSchema,
  usernameSchema,
  dateSchema,
  timeSchema,
} from "@/lib/validations";
import {
  normalizeDigits,
  normalizePhoneInput,
  normalizeSmsIrMobile,
  normalizeOtpCode,
} from "@/lib/phone";
import { resolveNextPath } from "@/lib/redirect";
import { positiveInt, secretKey, secureCookies } from "@/lib/config";
import {
  generateOtpCode,
  hashOtp,
  getOtpExpiryMinutes,
  getOtpResendCooldownSeconds,
} from "@/lib/otp";
import { generateSlots } from "@/lib/schedule-slots";
import { normalizeSmsPreferences, isSmsEnabled } from "@/lib/sms-preferences";
import { rangesOverlap } from "@/lib/time-conflicts";
const input = {
  title: "Schedule",
  slotDuration: 30,
  gapMinutes: 10,
  daysConfig: [
    { date: "2027-01-01", ranges: [{ startTime: "10:00", endTime: "12:00" }] },
  ],
  questions: [],
};
describe("validation and normalization", () => {
  it.each([
    "09123456789",
    "9123456789",
    "+989123456789",
    "00989123456789",
    "۰۹۱۲۳۴۵۶۷۸۹",
    "٠٩١٢٣٤٥٦٧٨٩",
  ])("normalizes %s", (value) =>
    expect(phoneSchema.parse(value)).toBe("09123456789"),
  );
  it.each(["", "123", "0912345678", "091234567890", "+441234567890"])(
    "rejects invalid phone %s",
    (value) => expect(normalizePhoneInput(value)).toBeNull(),
  );
  it("normalizes digits and provider numbers", () => {
    expect(normalizeDigits("۱۲٣")).toBe("123");
    expect(normalizeOtpCode("۱۲۳۴۵۶")).toBe("123456");
    expect(normalizeSmsIrMobile("09123456789")).toBe("9123456789");
    expect(normalizeSmsIrMobile("123")).toBe("123");
  });
  it.each(["99:00", "24:00", "10:60", "1:30", "-1:00"])(
    "rejects time %s",
    (v) => expect(timeSchema.safeParse(v).success).toBe(false),
  );
  it.each([
    "2027-02-31",
    "2027-02-29",
    "2027-13-01",
    "2027-00-01",
    "2027-01-00",
    "bad",
  ])("rejects date %s", (v) =>
    expect(dateSchema.safeParse(v).success).toBe(false),
  );
  it("handles leap days", () =>
    expect(dateSchema.parse("2028-02-29")).toBe("2028-02-29"));
  it.each([
    { slotDuration: 5.5 },
    { slotDuration: 0 },
    { gapMinutes: -1 },
    { gapMinutes: 1.5 },
    { title: "x" },
    { questions: Array(6).fill({ label: "Q", type: "text", required: false }) },
  ])("rejects invalid schedule %j", (patch) =>
    expect(scheduleSchema.safeParse({ ...input, ...patch }).success).toBe(
      false,
    ),
  );
  it("limits answer size and count", () => {
    expect(
      bookingSchema.safeParse({ timeSlotId: "x", answers: Array(6).fill("") })
        .success,
    ).toBe(false);
    expect(
      bookingSchema.safeParse({ timeSlotId: "x", answers: ["x".repeat(4001)] })
        .success,
    ).toBe(false);
  });
  it("checks registration credentials and confirmation", () => {
    expect(
      requestOtpSchema.safeParse({ phone: "09123456789", mode: "register" })
        .success,
    ).toBe(false);
    expect(
      requestOtpSchema.safeParse({
        phone: "09123456789",
        mode: "register",
        username: "user",
        password: "Password123",
        confirmPassword: "wrong",
      }).success,
    ).toBe(false);
    expect(usernameSchema.parse("  user  ")).toBe("user");
    expect(
      changePasswordSchema.safeParse({
        code: "123456",
        newPassword: "Password123",
        confirmPassword: "wrong",
      }).success,
    ).toBe(false);
  });
});
describe("safe redirects", () => {
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/login",
    "/login?next=/",
    "/register/",
    "/\n/evil.test",
    "",
  ])("rejects %s", (v) => expect(resolveNextPath(v)).toBe("/dashboard"));
  it("preserves local destination, query and fragment", () =>
    expect(resolveNextPath("/schedule/abc?x=1#slots")).toBe(
      "/schedule/abc?x=1#slots",
    ));
});
describe("slot generation", () => {
  const now = new Date("2026-12-31T00:00:00Z");
  it("uses Tehran time independently of host time zone", () => {
    const result = generateSlots(scheduleSchema.parse(input), now);
    expect(result.slots).toHaveLength(3);
    expect(result.slots[0].startTime.toISOString()).toBe(
      "2027-01-01T06:30:00.000Z",
    );
    expect(
      result.slots[1].startTime.getTime() - result.slots[0].startTime.getTime(),
    ).toBe(40 * 60000);
  });
  it("merges dates and rejects overlapping ranges", () => {
    expect(() =>
      generateSlots(
        scheduleSchema.parse({
          ...input,
          daysConfig: [...input.daysConfig, ...input.daysConfig],
        }),
        now,
      ),
    ).toThrow("Overlapping");
  });
  it("rejects past dates, empty future slots, and oversized schedules", () => {
    expect(() =>
      generateSlots(scheduleSchema.parse(input), new Date("2028-01-01")),
    ).toThrow("Past dates");
    expect(() =>
      generateSlots(scheduleSchema.parse({ ...input, slotDuration: 180 }), now),
    ).toThrow("No future");
    const daysConfig = Array.from({ length: 90 }, (_, i) => ({
      date: new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10),
      ranges: [{ startTime: "00:00", endTime: "23:59" }],
    }));
    expect(() =>
      generateSlots(
        scheduleSchema.parse({
          ...input,
          slotDuration: 5,
          gapMinutes: 0,
          daysConfig,
        }),
        now,
      ),
    ).toThrow("Too many");
  });
  it("allows adjacent ranges and excludes elapsed slots", () => {
    const data = {
      ...input,
      daysConfig: [
        {
          date: "2027-01-01",
          ranges: [
            { startTime: "10:00", endTime: "11:00" },
            { startTime: "11:00", endTime: "12:00" },
          ],
        },
      ],
    };
    expect(
      generateSlots(
        scheduleSchema.parse(data),
        new Date("2027-01-01T07:00Z"),
      ).slots.every((s) => s.startTime > new Date("2027-01-01T07:00Z")),
    ).toBe(true);
  });
});
describe("configuration and small domain functions", () => {
  it.each([undefined, "bad", "0", "-1", "Infinity", "1.5"])(
    "defaults invalid integer %s",
    (v) => expect(positiveInt(v, 5)).toBe(5),
  );
  it("validates ranges and secrets", () => {
    expect(positiveInt("10", 5, 20)).toBe(10);
    expect(positiveInt("21", 5, 20)).toBe(5);
    expect(secretKey("OTP_SECRET")).toBeInstanceOf(Uint8Array);
    vi.stubEnv("OTP_SECRET", "change-me");
    expect(() => secretKey("OTP_SECRET")).toThrow();
  });
  it("sets secure cookies from deployment URL", () => {
    vi.stubEnv("NEXTAUTH_URL", "https://example.com");
    expect(secureCookies()).toBe(true);
    vi.stubEnv("NEXTAUTH_URL", "http://localhost");
    expect(secureCookies()).toBe(false);
  });
  it("generates codes and binds hashes to phone and secret", () => {
    for (let i = 0; i < 100; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
    expect(hashOtp("09123456789", "123456")).not.toBe(
      hashOtp("09123456788", "123456"),
    );
    expect(hashOtp("09123456789", "123456")).not.toBe(
      hashOtp("09123456789", "123457"),
    );
    vi.stubEnv("OTP_EXPIRES_MINUTES", "Infinity");
    vi.stubEnv("OTP_RESEND_COOLDOWN_SECONDS", "0");
    expect(getOtpExpiryMinutes()).toBe(2);
    expect(getOtpResendCooldownSeconds()).toBe(60);
  });
  it("normalizes SMS preferences without trusting arbitrary JSON", () => {
    expect(normalizeSmsPreferences(null)).toEqual({
      bookingCreated: true,
      bookingCanceled: true,
      bookingReminder: true,
    });
    expect(normalizeSmsPreferences([]).bookingCreated).toBe(true);
    expect(isSmsEnabled({ bookingCreated: false }, "bookingCreated")).toBe(
      false,
    );
    expect(
      normalizeSmsPreferences({ bookingReminder: "false" }).bookingReminder,
    ).toBe(true);
  });
  it("uses half-open time ranges", () => {
    const a = new Date(0),
      b = new Date(10),
      c = new Date(20);
    expect(rangesOverlap(a, b, b, c)).toBe(false);
    expect(rangesOverlap(a, c, b, c)).toBe(true);
  });
});
