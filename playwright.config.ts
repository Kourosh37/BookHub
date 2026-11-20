import "./tests/env";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "fa-IR",
    timezoneId: "Asia/Tehran",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel:
          process.platform === "win32" && !process.env.CI
            ? "chrome"
            : undefined,
      },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        channel:
          process.platform === "win32" && !process.env.CI
            ? "chrome"
            : undefined,
      },
    },
  ],
  webServer: [
    {
      command: "tsx tests/e2e/sms-server.ts",
      url: "http://127.0.0.1:3101/health",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "tsx tests/e2e/start-app.ts",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
