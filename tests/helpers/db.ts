import "../env";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import { createSession } from "@/lib/auth";
import { withCookies } from "./cookies";
import bcrypt from "bcryptjs";

export async function resetDatabase() {
  // Tables, not schemas: migrations and their constraints are preserved for every test.
  await prisma.notificationJob.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.timeSlot.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.otpAttempt.deleteMany();
  await prisma.adminSession.deleteMany();
  await prisma.adminAuditLog.deleteMany();
  await prisma.smsLog.deleteMany();
  await prisma.smsGlobalSetting.deleteMany();
  const redis = getRedis();
  if (redis?.status === "wait") await redis.connect();
  await redis?.flushdb();
}
export async function createUser(name: string, phone: string) {
  return prisma.user.create({
    data: {
      username: name,
      phone,
      password: await bcrypt.hash("Password123!", 4),
    },
  });
}
export function asUser<T>(
  user: { id: string; phone: string | null; sessionVersion: number },
  action: () => Promise<T>,
) {
  return withCookies(new Map(), async () => {
    await createSession({
      userId: user.id,
      phone: user.phone!,
      sessionVersion: user.sessionVersion,
    });
    return action();
  });
}
export const request = (body: unknown, url = "http://localhost/api/test") =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
export async function disconnect() {
  await prisma.$disconnect();
  await getRedis()?.quit();
}
