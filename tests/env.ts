// Fixed test credentials; never read or reset the developer's .env database.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://bookhub_test:bookhub_test@127.0.0.1:55432/bookhub_test?schema=public";
process.env.REDIS_URL =
  process.env.TEST_REDIS_URL || "redis://127.0.0.1:56379/1";
process.env.NEXTAUTH_SECRET =
  "test-session-secret-at-least-thirty-two-characters";
process.env.OTP_SECRET = "test-otp-secret-at-least-thirty-two-characters";
process.env.ADMIN_PANEL_USERNAME = "test-admin";
process.env.ADMIN_PANEL_PASSWORD = "Test-admin-password-123!";
process.env.ADMIN_PANEL_SECRET =
  "test-admin-secret-at-least-thirty-two-characters";
process.env.CRON_SECRET = "test-cron-secret-at-least-thirty-two-characters";
process.env.NEXTAUTH_URL = "http://127.0.0.1:3100";
process.env.SMS_API_KEY = "test-provider-key";
process.env.SMS_TEMPLATE_OTP = "1";
process.env.SMS_TEMPLATE_BOOKING_REMINDER = "2";
process.env.SMS_TEMPLATE_BOOKING_CANCELED = "3";
process.env.SMS_TEMPLATE_BOOKING_CREATED_HOST = "4";
process.env.SMS_TEMPLATE_BOOKING_CREATED_GUEST = "5";
process.env.LOG_LEVEL = "silent";
process.env.NEXT_TELEMETRY_DISABLED = "1";
if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test"))
  throw new Error("Tests require a database whose name ends in _test");
if (
  !new URL(process.env.REDIS_URL).pathname ||
  new URL(process.env.REDIS_URL).pathname === "/0"
)
  throw new Error("Tests require a dedicated nonzero Redis database");
