import "../env";
import { test as base, expect, Page, BrowserContext } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { SignJWT } from "jose";
import { resetDatabase, createUser } from "../helpers/db";
import { generateSlots } from "@/lib/schedule-slots";
import { scheduleSchema } from "@/lib/validations";
export { expect };
type Seed = {
  host: Awaited<ReturnType<typeof createUser>>;
  guest: Awaited<ReturnType<typeof createUser>>;
  shareId: string;
  scheduleId: string;
};
export const test = base.extend<{ seed: Seed; noPageErrors: void }>({
  noPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const onError = (error: Error) => errors.push(error.message);
      page.on("pageerror", onError);
      await use();
      page.off("pageerror", onError);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
  seed: [
    async ({}, use) => {
      await resetDatabase();
      await fetch("http://127.0.0.1:3101/messages", { method: "DELETE" });
      const host = await createUser("host", "09111111111"),
        guest = await createUser("guest", "09222222222");
      const input = scheduleSchema.parse({
        title: "برنامه آزمایشی",
        slotDuration: 30,
        gapMinutes: 10,
        daysConfig: [
          {
            date: new Date(Date.now() + 2 * 86400000)
              .toISOString()
              .slice(0, 10),
            ranges: [{ startTime: "10:00", endTime: "12:00" }],
          },
        ],
        questions: [
          { label: "نام و نام خانوادگی", type: "text", required: true },
        ],
      });
      const { slots, daysConfig } = generateSlots(input);
      const schedule = await prisma.schedule.create({
        data: {
          ...input,
          daysConfig,
          userId: host.id,
          shareId: "e2e-schedule",
          slots: { createMany: { data: slots } },
        },
      });
      await use({
        host,
        guest,
        shareId: schedule.shareId,
        scheduleId: schedule.id,
      });
    },
    { auto: true },
  ],
});
export async function loginAs(context: BrowserContext, user: Seed["host"]) {
  const token = await new SignJWT({
    userId: user.id,
    phone: user.phone,
    sessionVersion: user.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET!));
  await context.addCookies([
    {
      name: "bookhub_session",
      value: token,
      url: "http://127.0.0.1:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
export async function openTab(page: Page, name: string) {
  await page
    .getByRole("button", { name, exact: true })
    .filter({ visible: true })
    .click();
}
export async function readOtp(phone: string) {
  const response = await fetch("http://127.0.0.1:3101/messages");
  const rows = (await response.json()) as Array<{
    mobile: string;
    parameters: Array<{ name: string; value: string }>;
  }>;
  const row = rows.filter((m) => m.mobile === phone.slice(1)).at(-1);
  return row!.parameters.find((p) => p.name === "CODE")!.value;
}
