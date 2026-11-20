import { it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { sendOtpSms, sendTemplateSms } from "@/lib/sms";
import { prisma } from "@/lib/prisma";
import { bookingViewSchema } from "@/lib/client-schemas";
vi.mock("@/lib/prisma", () => ({
  prisma: { smsLog: { create: vi.fn().mockResolvedValue({}) } },
}));
it("rejects cross-origin writes and bounds request identifiers", () => {
  expect(
    proxy(
      new NextRequest("http://127.0.0.1:3100/api/profile", {
        method: "PATCH",
        headers: { origin: "https://evil.test" },
      }),
    ).status,
  ).toBe(403);
  const valid = proxy(
    new NextRequest("http://127.0.0.1:3100/api/profile", {
      method: "PATCH",
      headers: { origin: "http://127.0.0.1:3100", "x-request-id": "abc-123" },
    }),
  );
  expect(valid.headers.get("x-request-id")).toBe("abc-123");
  const malformed = proxy(
    new NextRequest("http://127.0.0.1:3100/", {
      headers: { "x-request-id": "x".repeat(100) },
    }),
  );
  expect(malformed.headers.get("x-request-id")?.length).toBe(36);
});
it("validates booking response shapes rather than trusting fetch JSON", () => {
  expect(bookingViewSchema.safeParse({}).success).toBe(false);
});
it("validates provider configuration and never silently pretends an OTP was sent", async () => {
  vi.stubEnv("SMS_API_KEY", "");
  await expect(
    sendOtpSms({ phone: "09123456789", code: "123456" }),
  ).rejects.toThrow();
  await expect(
    sendTemplateSms({ phone: "09123456789", templateId: 1, parameters: [] }),
  ).rejects.toThrow();
});
it("validates template configuration before sending", async () => {
  vi.stubEnv("SMS_TEMPLATE_OTP", "bad");
  await expect(
    sendOtpSms({ phone: "09123456789", code: "123456" }),
  ).rejects.toThrow();
});
it.each([500, 429])("logs HTTP provider failures %s", async (status) => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () => new Response("upstream failure", { status }),
  );
  await expect(
    sendOtpSms({ phone: "09123456789", code: "123456" }),
  ).rejects.toThrow();
  expect(prisma.smsLog.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: "FAILED" }),
    }),
  );
});
it("rejects provider-level errors and tolerates failure of best-effort SMS logging", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () =>
      Response.json({ status: 0, message: "Rejected" }),
    );
  await expect(
    sendOtpSms({ phone: "09123456789", code: "123456" }),
  ).rejects.toThrow("Rejected");
  vi.mocked(prisma.smsLog.create).mockRejectedValue(new Error("logging down"));
  fetch.mockImplementation(async () =>
    Response.json({ status: 1, message: "Sent" }),
  );
  expect(
    await sendTemplateSms({
      phone: "09123456789",
      templateId: 2,
      parameters: [],
      smsType: "GENERIC",
    }),
  ).toMatchObject({ ok: true });
});
