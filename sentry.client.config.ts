import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0"),
  replaysSessionSampleRate: Number(process.env.SENTRY_REPLAY_SAMPLE_RATE || "0"),
  replaysOnErrorSampleRate: Number(process.env.SENTRY_REPLAY_ERROR_SAMPLE_RATE || "0"),
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});

