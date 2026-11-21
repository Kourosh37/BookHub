import { test, expect, loginAs, openTab, readOtp } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import { prisma } from "@/lib/prisma";

test("public pages, Persian RTL, theme persistence and responsive layout", async ({
  page,
}) => {
  for (const path of ["/", "/login", "/register", "/admin_panel"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("body")).not.toHaveText("");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "تغییر تم" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("protects dashboard and preserves booking destination through registration", async ({
  page,
  seed,
}) => {
  const privateRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      [
        "/api/profile/sms-preferences",
        "/api/schedules/my",
        "/api/bookings/my",
        "/api/bookings/mine",
      ].includes(path)
    )
      privateRequests.push(path);
  });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  expect(privateRequests).toEqual([]);
  await page.goto("/schedule/" + seed.shareId);
  await expect(page).toHaveURL(/login\?next=/);
  await page.getByRole("link", { name: "ثبت‌نام", exact: true }).click();
  await expect(page).toHaveURL(/register\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(
    "/schedule/" + seed.shareId,
  );
  expect(privateRequests).toEqual([]);
});
test("logs in with a real password and logs out", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "ورود با رمز" }).click();
  await page.getByPlaceholder("نام کاربری یا شماره موبایل").fill("guest");
  await page.getByPlaceholder("رمز عبور", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: /خروج/ }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test("registers using OTP delivered to the isolated provider", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByPlaceholder("نام کاربری", { exact: true }).fill("newuser");
  await page.getByPlaceholder("09xxxxxxxxx").fill("09444444444");
  await page.getByPlaceholder("رمز عبور", { exact: true }).fill("Password123!");
  await page.getByPlaceholder("تکرار رمز عبور").fill("Password123!");
  await page
    .getByRole("button", { name: "ارسال کد تایید", exact: true })
    .click();
  await expect(page.getByPlaceholder("کد ۶ رقمی")).toBeVisible();
  await page.getByPlaceholder("کد ۶ رقمی").fill(await readOtp("09444444444"));
  await page.getByRole("button", { name: "تایید و ورود", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await prisma.user.count({ where: { username: "newuser" } })).toBe(1);
});
test("books a real slot, answers required questions, then cancels it", async ({
  page,
  context,
  seed,
}) => {
  await loginAs(context, seed.guest);
  await page.goto("/schedule/" + seed.shareId);
  await expect(
    page.getByRole("heading", { name: "برنامه آزمایشی" }),
  ).toBeVisible();
  await page
    .locator("button")
    .filter({ hasText: /شنبه|یکشنبه|دوشنبه|سه‌شنبه|چهارشنبه|پنجشنبه|جمعه/ })
    .first()
    .click();
  await page.getByRole("button", { name: "۱۰:۰۰", exact: true }).click();
  await page.getByPlaceholder("نام و نام خانوادگی").fill("کاربر تست");
  await page.getByRole("button", { name: "ثبت رزرو", exact: true }).click();
  await expect(page.getByText("رزرو با موفقیت ثبت شد")).toBeVisible();
  await page.goto("/dashboard");
  await openTab(page, "جلسات من");
  await expect(page.getByText("برنامه آزمایشی").first()).toBeVisible();
  await page.getByRole("button", { name: "کنسل رزرو", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "بله، کنسل کن" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByLabel("نمایش سوابق").selectOption("canceled");
  await expect(page.getByText("برنامه آزمایشی").first()).toBeVisible();
  expect(await prisma.booking.count({ where: { status: "CANCELED" } })).toBe(1);
});
test("updates profile, preferences, and handles network failure without stuck controls", async ({
  page,
  context,
  seed,
}) => {
  await loginAs(context, seed.guest);
  await page.goto("/dashboard");
  await openTab(page, "پروفایل");
  await page
    .getByRole("button", { name: "تغییر نام کاربری", exact: true })
    .click();
  const field = page.getByRole("textbox", { name: "نام کاربری جدید" });
  await expect(field.locator("..").locator("..")).toHaveCSS("opacity", "1");
  await field.fill("renamed");
  await page.getByRole("button", { name: "ذخیره نام کاربری" }).click();
  await expect(page.getByText("پروفایل به‌روزرسانی شد")).toBeVisible();
  await page.route("**/api/profile", (route) => route.abort());
  await field.fill("offline-name");
  await page.getByRole("button", { name: "ذخیره نام کاربری" }).click();
  await expect(
    page.getByRole("button", { name: "ذخیره نام کاربری" }),
  ).toBeEnabled();
  await page.unroute("**/api/profile");
  await openTab(page, "تنظیمات");
  await page
    .getByRole("button", { name: "تنظیمات پیامک", exact: true })
    .click();
  await page.getByRole("checkbox").first().uncheck();
  await expect
    .poll(async () => {
      const u = await prisma.user.findUniqueOrThrow({
        where: { id: seed.guest.id },
      });
      return (u.smsPreferences as { bookingCreated: boolean } | null)
        ?.bookingCreated;
    })
    .toBe(false);
});
test("admin authentication, user search, SMS settings and logout", async ({
  page,
}) => {
  await page.goto("/admin_panel");
  await page.locator('input[autocomplete="username"]').fill("test-admin");
  const password = page.locator('input[autocomplete="current-password"]');
  await password.fill("incorrect-password");
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(page.getByText("Unauthorized", { exact: true })).toBeVisible();
  await password.fill("Test-admin-password-123!");
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(page.getByRole("button", { name: /خروج/ })).toBeVisible();
  await page
    .getByPlaceholder("جستجو با شماره موبایل یا نام کاربری")
    .fill("guest");
  await expect(page.getByText("guest", { exact: true })).toBeVisible();
  const created = page.getByRole("checkbox", {
    name: "رزرو جدید",
    exact: true,
  });
  await expect(created).toBeChecked();
  await created.click();
  await expect
    .poll(
      async () =>
        (await prisma.smsGlobalSetting.findUniqueOrThrow({ where: { id: 1 } }))
          .bookingCreatedEnabled,
    )
    .toBe(false);
  await expect(created).not.toBeChecked();
  await expect(created).toBeEnabled();
  await page.route("**/api/admin/sms-settings", (r) =>
    r.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Simulated settings failure" }),
    }),
  );
  await created.click();
  await expect(
    page.getByText("Simulated settings failure", { exact: true }),
  ).toBeVisible();
  await expect(created).not.toBeChecked();
  await expect(created).toBeEnabled();
  await page.unroute("**/api/admin/sms-settings");
  await created.click();
  await expect
    .poll(
      async () =>
        (await prisma.smsGlobalSetting.findUniqueOrThrow({ where: { id: 1 } }))
          .bookingCreatedEnabled,
    )
    .toBe(true);
  await expect(created).toBeChecked();
  await page.route("**/api/admin/logout", (r) =>
    r.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await page.getByRole("button", { name: /خروج/ }).click();
  await expect(
    page.getByText("خروج ناموفق بود. دوباره تلاش کنید.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /خروج/ })).toBeVisible();
  await page.unroute("**/api/admin/logout");
  await page.getByRole("button", { name: /خروج/ }).click();
  await expect(
    page.getByRole("button", { name: "ورود", exact: true }),
  ).toBeVisible();
});

test("checks accessibility of public forms and dashboard tabs", async ({
  page,
  context,
  seed,
}) => {
  for (const path of ["/", "/login", "/register", "/admin_panel"]) {
    await page.goto(path);
    await page.waitForTimeout(100);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.html),
      })),
    ).toEqual([]);
  }
  await loginAs(context, seed.guest);
  await page.goto("/dashboard");
  for (const tab of [
    "برنامه‌های من",
    "رزروهای من",
    "جلسات من",
    "پروفایل",
    "تنظیمات",
  ]) {
    await openTab(page, tab);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.html),
      })),
    ).toEqual([]);
  }
});

test("creates a schedule from a saved draft, edits its title, shares QR and deletes it", async ({
  page,
  context,
  seed,
}) => {
  await loginAs(context, seed.host);
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await page.addInitScript(
    ({ date }) =>
      localStorage.setItem(
        "bookhub:schedule-draft",
        JSON.stringify({
          title: "برنامه جدید تست",
          slotDuration: 30,
          gapMinutes: 10,
          selectedDates: [date],
          dayConfigs: [
            { date, ranges: [{ startTime: "10:00", endTime: "12:00" }] },
          ],
          questions: [],
        }),
      ),
    { date },
  );
  await page.goto("/dashboard");
  const mobileToggle = page.getByRole("button", {
    name: "برنامه جدید",
    exact: true,
  });
  if (await mobileToggle.isVisible()) await mobileToggle.click();
  await page.getByRole("button", { name: "ایجاد برنامه", exact: true }).click();
  await expect(
    page.getByText("برنامه ساخته شد", { exact: true }),
  ).toBeVisible();
  expect(
    await prisma.schedule.count({ where: { title: "برنامه جدید تست" } }),
  ).toBe(1);
  const card = page
    .locator(".card")
    .filter({
      has: page.getByRole("heading", { name: "برنامه جدید تست", exact: true }),
    })
    .last();
  await card.getByRole("button", { name: "ویرایش نام برنامه" }).click();
  await page
    .getByRole("textbox", { name: "ویرایش نام برنامه" })
    .fill("عنوان ویرایش شده");
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "عنوان ویرایش شده", exact: true }),
  ).toBeVisible();
  const updated = page
    .locator(".card")
    .filter({
      has: page.getByRole("heading", { name: "عنوان ویرایش شده", exact: true }),
    })
    .last();
  await updated.getByRole("button", { name: "نمایش QR برنامه" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("link", { name: "دانلود QR" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await updated
    .getByRole("button", { name: "حذف برنامه", exact: true })
    .click();
  await page.getByRole("button", { name: "بله، حذف کن" }).click();
  await expect(
    page.getByRole("heading", { name: "عنوان ویرایش شده", exact: true }),
  ).toHaveCount(0);
});
test("downloads real PDF, image, CSV and Excel reports from the dashboard", async ({
  page,
  browser,
  context,
  seed,
}, testInfo) => {
  const visitor = await browser.newContext();
  await loginAs(visitor, seed.guest);
  const slot = await prisma.timeSlot.findFirstOrThrow({
    where: { scheduleId: seed.scheduleId },
    orderBy: { startTime: "asc" },
  });
  const booking = await visitor.request.post(
    "http://127.0.0.1:3100/api/schedules/" + seed.shareId + "/book",
    { data: { timeSlotId: slot.id, answers: ["کاربر تست"] } },
  );
  expect(booking.status()).toBe(200);
  await visitor.close();
  await loginAs(context, seed.host);
  await page.goto("/dashboard");
  await openTab(page, "رزروهای من");
  for (const format of ["PDF", "تصویر", "CSV", "Excel"]) {
    await test.step(`downloads ${format}`, async () => {
      await page.getByRole("button", { name: "خروجی گرفتن" }).click();
      if (format === "CSV" || format === "Excel") {
        await expect(
          page.getByRole("link", { name: format, exact: true }),
        ).toHaveAttribute(
          "download",
          format === "CSV" ? "bookings.csv" : "bookings.xls",
        );
      }
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByText(format, { exact: true }).click(),
      ]);
      expect(await download.failure()).toBeNull();
      const path = await download.path();
      expect(path).toBeTruthy();
      const { readFile } = await import("node:fs/promises");
      const bytes = await readFile(path!);
      await testInfo.attach(format, {
        body: bytes,
        contentType:
          format === "PDF"
            ? "application/pdf"
            : format === "CSV"
              ? "text/csv"
              : format === "Excel"
                ? "application/vnd.ms-excel"
                : "image/png",
      });
      if (format === "PDF")
        expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      if (format === "تصویر")
        expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      if (format === "CSV") expect(bytes.toString("utf8")).toContain("guest");
      if (format === "Excel") {
        expect(download.suggestedFilename()).toMatch(/\.xls$/);
        expect(bytes.toString("utf8")).toContain("<table");
        expect(bytes.toString("utf8")).toContain("guest");
      }
      await expect(page).toHaveURL(/\/dashboard$/);
    });
  }
});

test("downloads empty CSV and Excel reports without leaving the dashboard", async ({
  page,
  context,
  seed,
}) => {
  await loginAs(context, seed.host);
  await page.goto("/dashboard");
  await openTab(page, "رزروهای من");
  for (const [format, extension] of [
    ["CSV", "csv"],
    ["Excel", "xls"],
  ]) {
    await test.step(`downloads empty ${format}`, async () => {
      await page.getByRole("button", { name: "خروجی گرفتن" }).click();
      const link = page.getByRole("link", { name: format, exact: true });
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        link.click(),
      ]);
      expect(await download.failure()).toBeNull();
      expect(download.suggestedFilename()).toMatch(
        new RegExp(`\\.${extension}$`),
      );
      const { readFile } = await import("node:fs/promises");
      const body = await readFile((await download.path())!, "utf8");
      expect(body).toContain(format === "CSV" ? "Title,Booked By" : "<table");
      await expect(page).toHaveURL(/\/dashboard$/);
    });
  }
});
test("changes a password using OTP and keeps the current session usable", async ({
  page,
  context,
  seed,
}) => {
  await loginAs(context, seed.guest);
  await page.goto("/dashboard");
  await openTab(page, "پروفایل");
  await page
    .getByRole("button", { name: "تغییر رمز عبور", exact: true })
    .click();
  await page
    .getByRole("button", { name: "ارسال کد تایید", exact: true })
    .click();
  await expect(
    page.getByText("کد تایید ارسال شد", { exact: true }),
  ).toBeVisible();
  await page
    .getByPlaceholder("کد تایید", { exact: true })
    .fill(await readOtp(seed.guest.phone!));
  await page
    .getByPlaceholder("رمز عبور جدید", { exact: true })
    .fill("Changed-password123!");
  await page
    .getByPlaceholder("تکرار رمز عبور جدید")
    .fill("Changed-password123!");
  await page.getByRole("button", { name: "تایید تغییر رمز" }).click();
  await expect(page.getByText("رمز عبور تغییر کرد")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/dashboard$/);
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: seed.guest.id } }))
      .sessionVersion,
  ).toBe(1);
});
test("deletes an account only after confirmation OTP", async ({
  page,
  context,
  seed,
}) => {
  await loginAs(context, seed.guest);
  await page.goto("/dashboard");
  await openTab(page, "پروفایل");
  await page.getByRole("button", { name: "حذف اکانت", exact: true }).click();
  await page
    .getByRole("button", { name: "حذف حساب کاربری", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "ارسال کد تایید حذف" }).click();
  await expect(
    page.getByText("کد تایید ارسال شد", { exact: true }),
  ).toBeVisible();
  await page
    .getByPlaceholder("کد تایید ۶ رقمی")
    .fill(await readOtp(seed.guest.phone!));
  await page.getByRole("button", { name: "تایید حذف", exact: true }).click();
  await expect(page).toHaveURL(/login$/);
  expect(
    await prisma.user.findUnique({ where: { id: seed.guest.id } }),
  ).toBeNull();
});
test("shows retained completed bookings and retries failed reads", async ({
  page,
  context,
  seed,
}) => {
  const slot = await prisma.timeSlot.findFirstOrThrow({
    where: { scheduleId: seed.scheduleId },
  });
  await prisma.timeSlot.update({
    where: { id: slot.id },
    data: {
      startTime: new Date(Date.now() - 7200000),
      endTime: new Date(Date.now() - 3600000),
      isBooked: true,
    },
  });
  await prisma.booking.create({
    data: {
      scheduleId: seed.scheduleId,
      timeSlotId: slot.id,
      bookedByUserId: seed.guest.id,
      answers: ["تاریخچه"],
    },
  });
  await loginAs(context, seed.guest);
  await page.goto("/dashboard");
  await openTab(page, "جلسات من");
  await page.getByLabel("نمایش سوابق").selectOption("past");
  await expect(page.getByText("برنامه آزمایشی").last()).toBeVisible();
  await expect(page.getByRole("button", { name: "کنسل رزرو" })).toBeDisabled();
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporarily unavailable" }),
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: "دریافت اطلاعات ناموفق بود" }),
  ).toBeVisible();
  expect(page.url()).toContain("/dashboard");
  await page.unroute("**/api/auth/me");
  await page.getByRole("button", { name: "تلاش مجدد", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "دریافت اطلاعات ناموفق بود" }),
  ).toBeHidden();
});
test("uploads a cropped avatar and removes it with confirmation", async ({
  page,
  context,
  seed,
}) => {
  const sharp = (await import("sharp")).default;
  const png = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await loginAs(context, seed.guest);
  await page.goto("/dashboard");
  await openTab(page, "پروفایل");
  await page.getByRole("button", { name: "عکس پروفایل", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("crop source")).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText("crop source")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "ذخیره عکس", exact: true }).click();
  await expect(page.getByText("عکس پروفایل ذخیره شد")).toBeVisible();
  await page.getByRole("button", { name: "حذف عکس", exact: true }).click();
  await page.getByRole("button", { name: "بله، حذف کن" }).click();
  await expect(page.getByText("عکس پروفایل حذف شد")).toBeVisible();
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: seed.guest.id } }))
      .avatarUrl,
  ).toBeNull();
});

test("production HTTP boundaries reject cross-site writes, malformed JSON and image optimization", async ({
  request,
}) => {
  expect((await request.get("/api/health")).status()).toBe(200);
  expect(
    (
      await request.patch("/api/profile", {
        headers: { origin: "https://evil.invalid" },
        data: { username: "forged" },
      })
    ).status(),
  ).toBe(403);
  const invalid = await request.post("/api/auth/verify-otp", {
    headers: { "content-type": "application/json" },
    data: "{",
  });
  expect(invalid.status()).toBe(400);
  expect(
    (await request.get("/_next/image?url=%2Ffavicon.svg&w=64&q=75")).status(),
  ).toBe(404);
  const contract = await (await request.get("/api/openapi")).json();
  expect(contract.paths["/api/health"]).toBeDefined();
});
