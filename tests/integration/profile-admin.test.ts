import { beforeEach, afterAll, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import {
  resetDatabase,
  createUser,
  asUser,
  request,
  disconnect,
} from "../helpers/db";
import { withCookies } from "../helpers/cookies";
import * as profile from "@/services/profile/profile-service";
import * as admin from "@/services/admin/admin-service";
import {
  isAdminToken,
  isAdminRequest,
  isAdminSession,
  setAdminCookie,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import { checkSlidingWindowLimit } from "@/lib/rate-limit";
import { getRedis } from "@/lib/redis";
import {
  cacheGetJson,
  cacheSetJson,
  cacheDel,
  cacheDelByPattern,
  cacheSetCooldown,
  cacheGetCooldownRemaining,
} from "@/lib/cache";
let user: Awaited<ReturnType<typeof createUser>>;
beforeEach(async () => {
  await resetDatabase();
  user = await createUser("guest", "09222222222");
});
afterAll(disconnect);
it("updates profile/SMS settings with validation and uniqueness", async () => {
  await createUser("host", "09111111111");
  await asUser(user, async () => {
    expect((await profile.profileGet()).status).toBe(200);
    await profile.profilePatch(request({ username: "ChangedName" }));
    await expect(
      profile.profilePatch(request({ username: "host" })),
    ).rejects.toThrow();
    await expect(
      profile.profilePatch(request({ username: "x" })),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      await (await profile.profileSmsPreferencesGet()).json(),
    ).toHaveProperty("bookingCreated", true);
    await profile.profileSmsPreferencesPatch(
      request({
        bookingCreated: false,
        bookingCanceled: true,
        bookingReminder: false,
      }),
    );
    expect(
      await (await profile.profileSmsPreferencesGet()).json(),
    ).toHaveProperty("bookingCreated", false);
  });
  expect(profile.profileDeleteMethodNotAllowed().status).toBe(405);
});
it.each([
  "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
  "<html>bad</html>",
  "not an image",
])("rejects active/forged image content %s", async (content) => {
  await expect(
    profile.sanitizeAvatar(Buffer.from(content)),
  ).rejects.toMatchObject({ status: 400 });
});
it("re-encodes image bytes instead of trusting MIME and securely serves/removes avatars", async () => {
  const source = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  expect(
    (await sharp(await profile.sanitizeAvatar(source)).metadata()).format,
  ).toBe("jpeg");
  const fd = new FormData();
  fd.append(
    "file",
    new File([new Uint8Array(source)], "attack.svg", { type: "image/svg" }),
  );
  const { avatarUrl } = await (
    await asUser(user, () =>
      profile.profileAvatarUpload(
        new Request("http://localhost", { method: "POST", body: fd }),
      ),
    )
  ).json();
  expect(avatarUrl).toMatch(/\.jpg$/);
  const served = await profile.profileAvatarFileGet(avatarUrl.split("/").pop());
  expect(served.headers.get("content-type")).toBe("image/jpeg");
  expect(served.headers.get("content-security-policy")).toContain("sandbox");
  await asUser(user, () => profile.profileAvatarDelete(request({})));
  await expect(
    profile.profileAvatarFileGet(avatarUrl.split("/").pop()),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    profile.profileAvatarFileGet("../secret.svg"),
  ).rejects.toMatchObject({ status: 404 });
});
it("rejects empty/oversized uploads and honors upload rate limits", async () => {
  await expect(
    asUser(user, () =>
      profile.profileAvatarUpload(
        new Request("http://localhost", {
          method: "POST",
          body: new FormData(),
        }),
      ),
    ),
  ).rejects.toMatchObject({ status: 400 });
  const fd = new FormData();
  fd.append(
    "file",
    new File([new Uint8Array(3 * 1024 * 1024)], "large.png", {
      type: "image/png",
    }),
  );
  await expect(
    asUser(user, () =>
      profile.profileAvatarUpload(
        new Request("http://localhost", { method: "POST", body: fd }),
      ),
    ),
  ).rejects.toMatchObject({ status: 413 });
  vi.stubEnv("AVATAR_UPLOAD_RATE_LIMIT_USER_MAX", "1");
  await expect(
    asUser(user, () =>
      profile.profileAvatarUpload(
        new Request("http://localhost", {
          method: "POST",
          body: new FormData(),
        }),
      ),
    ),
  ).rejects.toMatchObject({ status: 429 });
});
it("uses random expiring admin sessions and revokes the actual server token on logout", async () => {
  const response = await admin.adminLogin(
    request({ username: "test-admin", password: "Test-admin-password-123!" }),
  );
  const token = response.headers
    .get("set-cookie")!
    .match(/bookhub_admin=([^;]+)/)![1];
  expect(await isAdminToken(token)).toBe(true);
  expect(await isAdminToken("é".repeat(64))).toBe(false);
  expect(await isAdminToken(null)).toBe(false);
  const req = new NextRequest("http://localhost", {
    headers: { cookie: "bookhub_admin=" + token },
  });
  expect(await isAdminRequest(req)).toBe(true);
  await withCookies(new Map([["bookhub_admin", token]]), async () => {
    expect(await isAdminSession()).toBe(true);
    expect((await admin.adminMe()).status).toBe(200);
  });
  expect((await admin.adminOverview(req)).status).toBe(200);
  expect(
    (
      await admin.adminUsers(
        new NextRequest("http://localhost?q=guest&page=NaN&pageSize=Infinity", {
          headers: { cookie: "bookhub_admin=" + token },
        }),
      )
    ).status,
  ).toBe(200);
  expect((await admin.adminSmsSettingsGet(req)).status).toBe(200);
  expect(
    (
      await admin.adminSmsSettingsPatch(
        new NextRequest("http://localhost", {
          method: "PATCH",
          headers: {
            cookie: "bookhub_admin=" + token,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            bookingCreatedEnabled: false,
            bookingCanceledEnabled: true,
            bookingReminderEnabled: true,
          }),
        }),
      )
    ).status,
  ).toBe(200);
  await admin.adminLogout(req);
  expect(await isAdminToken(token)).toBe(false);
  const second = new NextResponse();
  await setAdminCookie(second);
  const t = second.headers
    .get("set-cookie")!
    .match(/bookhub_admin=([^;]+)/)![1];
  await prisma.adminSession.updateMany({
    data: { expiresAt: new Date(Date.now() - 1) },
  });
  expect(await isAdminToken(t)).toBe(false);
});
it("invalidates admin sessions after a credential rotation", async () => {
  const res = new NextResponse();
  await setAdminCookie(res);
  const token = res.headers
    .get("set-cookie")!
    .match(/bookhub_admin=([^;]+)/)![1];
  vi.stubEnv("ADMIN_PANEL_PASSWORD", "Rotated-password123!");
  expect(await isAdminToken(token)).toBe(false);
});
it("limits admin login guesses and rejects unauthorized endpoints", async () => {
  expect(verifyAdminCredentials("wrong", "wrong")).toBe(false);
  for (let i = 0; i < 5; i++)
    expect(
      (await admin.adminLogin(request({ username: "bad", password: "bad" })))
        .status,
    ).toBe(401);
  await expect(
    admin.adminLogin(
      request({ username: "test-admin", password: "Test-admin-password-123!" }),
    ),
  ).rejects.toMatchObject({ status: 429 });
  for (const action of [
    admin.adminOverview,
    admin.adminUsers,
    admin.adminSmsSettingsGet,
  ])
    expect((await action(new NextRequest("http://localhost"))).status).toBe(
      401,
    );
  expect((await admin.adminMe()).status).toBe(401);
});
it("rate limits atomically under concurrency without counting rejected requests", async () => {
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      checkSlidingWindowLimit({
        key: "race-limit",
        limit: 5,
        windowSeconds: 60,
      }),
    ),
  );
  expect(results.filter((r) => r.allowed)).toHaveLength(5);
  expect(await getRedis()!.zcard("race-limit")).toBe(5);
  await expect(
    checkSlidingWindowLimit({ key: "x", limit: NaN, windowSeconds: 60 }),
  ).rejects.toThrow("configuration");
});
it("supports cache reads, deletion, pattern invalidation and cooldown", async () => {
  await cacheSetJson("test:a", { value: 1 }, 60);
  expect(await cacheGetJson("test:a")).toEqual({ value: 1 });
  await cacheSetJson("test:b", 2, 60);
  await cacheDelByPattern("test:*");
  expect(await cacheGetJson("test:a")).toBeNull();
  await cacheSetCooldown("cool", 60);
  expect(await cacheGetCooldownRemaining("cool")).toBeGreaterThan(0);
  await cacheDel("cool");
  expect(await cacheGetCooldownRemaining("cool")).toBeNull();
  await getRedis()!.set("invalid-json", "{");
  expect(await cacheGetJson("invalid-json")).toBeNull();
});
