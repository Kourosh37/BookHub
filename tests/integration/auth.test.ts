import { beforeEach, afterAll, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  resetDatabase,
  createUser,
  asUser,
  request,
  disconnect,
} from "../helpers/db";
import { mockSms, smsCode, makeSchedule, book } from "../helpers/fixtures";
import { withCookies } from "../helpers/cookies";
import * as auth from "@/services/auth/auth-service";
import * as profile from "@/services/profile/profile-service";
import { issueOtp, verifyOtpAndRun } from "@/lib/otp-security";
import { createSession, getSession, clearSession } from "@/lib/auth";
let user: Awaited<ReturnType<typeof createUser>>;
beforeEach(async () => {
  await resetDatabase();
  user = await createUser("guest", "09222222222");
});
afterAll(disconnect);
it("registers only after OTP verification and never returns password hashes", async () => {
  const sms = mockSms(),
    body = {
      mode: "register",
      phone: "09444444444",
      username: "  newuser  ",
      password: "Password123!",
      confirmPassword: "Password123!",
    };
  await auth.requestOtp(request(body));
  expect(
    await prisma.user.findUnique({ where: { phone: body.phone } }),
  ).toBeNull();
  const res = await auth.verifyAuthOtp(
    request({ phone: body.phone, code: smsCode(sms) }),
  );
  expect(await res.json()).toMatchObject({ ok: true, phone: body.phone });
  const created = await prisma.user.findUniqueOrThrow({
    where: { phone: body.phone },
  });
  expect(created.username).toBe("newuser");
  expect(created.password).not.toBe(body.password);
  const me = await (await auth.authMe()).json();
  expect(me.user.id).toBe(created.id);
  expect(me.user.password).toBeUndefined();
  await auth.authLogout();
  expect((await auth.authMe()).status).toBe(401);
});
it("logs in with password using either phone or username with uniform errors", async () => {
  await expect(
    auth.passwordLogin(
      request({ identifier: user.username, password: "wrongpass" }),
    ),
  ).rejects.toMatchObject({ status: 401 });
  await expect(
    auth.passwordLogin(
      request({ identifier: "missing", password: "wrongpass" }),
    ),
  ).rejects.toMatchObject({ status: 401 });
  for (const identifier of [user.phone, user.username])
    expect(
      (
        await auth.passwordLogin(
          request({ identifier, password: "Password123!" }),
        )
      ).status,
    ).toBe(200);
});
it("rejects duplicate registration, unknown login and unauthenticated password reset", async () => {
  mockSms();
  await expect(
    auth.requestOtp(request({ mode: "login_phone", phone: "09555555555" })),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    auth.requestOtp(request({ mode: "password_reset", phone: user.phone })),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    auth.requestOtp(
      request({
        mode: "register",
        phone: user.phone,
        username: "xuser",
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    auth.requestOtp(
      request({
        mode: "register",
        phone: "09555555555",
        username: "guest",
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    ),
  ).rejects.toMatchObject({ status: 409 });
});
it.each(["AUTH", "PASSWORD_RESET", "ACCOUNT_DELETE"] as const)(
  "checks the lock during %s verification",
  async (purpose) => {
    const sms = mockSms();
    await issueOtp(user.phone!, purpose);
    const code = smsCode(sms);
    for (let i = 0; i < 4; i++)
      await expect(
        verifyOtpAndRun(user.phone!, "000000", purpose, async () => true),
      ).rejects.toMatchObject({ status: 401 });
    await expect(
      verifyOtpAndRun(user.phone!, "000000", purpose, async () => true),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      verifyOtpAndRun(user.phone!, code, purpose, async () => true),
    ).rejects.toMatchObject({ status: 429 });
    await expect(issueOtp(user.phone!, purpose)).rejects.toMatchObject({
      status: 429,
    });
    expect((await prisma.otpAttempt.findFirstOrThrow()).failedCount).toBe(5);
  },
);
it("consumes a valid OTP only once even under concurrent verification", async () => {
  const sms = mockSms();
  await issueOtp(user.phone!, "AUTH");
  const code = smsCode(sms);
  const results = await Promise.allSettled(
    [1, 2, 3].map(() =>
      withCookies(new Map(), () =>
        auth.verifyAuthOtp(request({ phone: user.phone, code })),
      ),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    await prisma.otpCode.count({ where: { consumedAt: { not: null } } }),
  ).toBe(1);
});
it("serializes bad guesses instead of losing failed-attempt increments", async () => {
  mockSms();
  await issueOtp(user.phone!, "AUTH");
  await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      verifyOtpAndRun(user.phone!, "000000", "AUTH", async () => true),
    ),
  );
  expect((await prisma.otpAttempt.findFirstOrThrow()).failedCount).toBe(5);
});
it("rejects expired, superseded and wrong-purpose codes and honors resend cooldown", async () => {
  const sms = mockSms();
  await issueOtp(user.phone!, "AUTH");
  const old = smsCode(sms);
  await expect(issueOtp(user.phone!, "AUTH")).rejects.toMatchObject({
    status: 429,
  });
  await prisma.otpCode.updateMany({
    data: { createdAt: new Date(Date.now() - 120000) },
  });
  await issueOtp(user.phone!, "AUTH");
  await expect(
    verifyOtpAndRun(user.phone!, old, "AUTH", async () => true),
  ).rejects.toMatchObject({ status: 401 });
  const code = smsCode(sms);
  await expect(
    verifyOtpAndRun(user.phone!, code, "PASSWORD_RESET", async () => true),
  ).rejects.toMatchObject({ status: 401 });
  await prisma.otpCode.updateMany({
    data: { expiresAt: new Date(Date.now() - 1) },
  });
  await expect(
    verifyOtpAndRun(user.phone!, code, "AUTH", async () => true),
  ).rejects.toMatchObject({ status: 401 });
});
it("resets expired attempt windows and locks", async () => {
  const sms = mockSms();
  await issueOtp(user.phone!, "AUTH");
  const code = smsCode(sms);
  await prisma.otpAttempt.create({
    data: {
      phone: user.phone!,
      purpose: "AUTH",
      failedCount: 5,
      windowStart: new Date(Date.now() - 3600000),
      lockedUntil: new Date(Date.now() - 1),
    },
  });
  expect(
    await verifyOtpAndRun(user.phone!, code, "AUTH", async () => true),
  ).toBe(true);
  expect(await prisma.otpAttempt.count()).toBe(0);
});
it("rolls back OTP consumption when the protected action fails", async () => {
  const sms = mockSms();
  await issueOtp(user.phone!, "AUTH");
  const code = smsCode(sms);
  await expect(
    verifyOtpAndRun(user.phone!, code, "AUTH", async () => {
      throw new Error("database action failed");
    }),
  ).rejects.toThrow("database action");
  expect((await prisma.otpCode.findFirstOrThrow()).consumedAt).toBeNull();
});
it("removes failed SMS OTP records so another attempt is possible", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
  await expect(issueOtp(user.phone!, "AUTH")).rejects.toMatchObject({
    status: 502,
  });
  expect(await prisma.otpCode.count()).toBe(0);
});
it("renews the current session and invalidates old sessions after password change", async () => {
  const sms = mockSms(),
    jar = new Map<string, string>();
  let old = "";
  await withCookies(jar, async () => {
    await createSession({ userId: user.id, phone: user.phone! });
    old = jar.get("bookhub_session")!;
    await profile.profilePasswordRequestOtp();
    await profile.profilePasswordConfirm(
      request({
        code: smsCode(sms),
        newPassword: "Changed123!",
        confirmPassword: "Changed123!",
      }),
    );
    expect(await getSession()).not.toBeNull();
  });
  expect(
    await withCookies(new Map([["bookhub_session", old]]), getSession),
  ).toBeNull();
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .sessionVersion,
  ).toBe(1);
});
it("rejects tampered and deleted-user sessions", async () => {
  expect(
    await withCookies(new Map([["bookhub_session", "invalid"]]), getSession),
  ).toBeNull();
  await asUser(user, async () => {
    await prisma.user.delete({ where: { id: user.id } });
    expect(await getSession()).toBeNull();
  });
  await clearSession();
});
it("requires deletion OTP, cancels guest bookings, frees slots and clears the session", async () => {
  const host = await createUser("host", "09111111111"),
    s = await makeSchedule(host);
  await book(s, user);
  const sms = mockSms();
  await asUser(user, async () => {
    await profile.profileDeleteRequestOtp();
    await expect(
      profile.profileDeleteConfirm(request({ code: "bad" })),
    ).rejects.toMatchObject({ status: 400 });
    await profile.profileDeleteConfirm(request({ code: smsCode(sms) }));
    expect(await getSession()).toBeNull();
  });
  expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  expect(
    (await prisma.timeSlot.findUniqueOrThrow({ where: { id: s.slots[0].id } }))
      .isBooked,
  ).toBe(false);
  expect((await prisma.booking.findFirstOrThrow()).status).toBe("CANCELED");
});
