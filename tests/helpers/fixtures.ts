import { vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { asUser, request } from "./db";
import {
  schedulesCreate,
  scheduleBook,
} from "@/services/schedules/schedules-service";
import type { User } from "@prisma/client";
export const futureDate = () =>
  new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
export const scheduleInput = (patch: Record<string, unknown> = {}) => ({
  title: "Test Schedule",
  slotDuration: 30,
  gapMinutes: 10,
  daysConfig: [
    { date: futureDate(), ranges: [{ startTime: "10:00", endTime: "12:00" }] },
  ],
  questions: [],
  ...patch,
});
export async function makeSchedule(
  user: User,
  patch: Record<string, unknown> = {},
) {
  const result = await (
    await asUser(user, () => schedulesCreate(request(scheduleInput(patch))))
  ).json();
  return {
    ...result,
    slots: await prisma.timeSlot.findMany({
      where: { scheduleId: result.id },
      orderBy: { startTime: "asc" },
    }),
  } as {
    id: string;
    shareId: string;
    slots: Array<{ id: string; startTime: Date; endTime: Date }>;
  };
}
export const book = (
  s: Awaited<ReturnType<typeof makeSchedule>>,
  user: User,
  index = 0,
  answers: string[] = [],
) =>
  asUser(user, () =>
    scheduleBook(
      request({ timeSlotId: s.slots[index].id, answers }),
      s.shareId,
    ),
  );
export const mockSms = () =>
  vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () =>
      Response.json({ status: 1, message: "Sent", data: { messageId: 123 } }),
    );
export function smsCode(spy: ReturnType<typeof mockSms>) {
  return JSON.parse(String(spy.mock.calls.at(-1)![1]!.body)).parameters[0]
    .value as string;
}
