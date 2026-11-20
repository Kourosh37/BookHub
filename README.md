# BookHub

Persian scheduling with Next.js 16, React 19, strict TypeScript, PostgreSQL 16/Prisma 6, Redis 7 and a BullMQ notification worker. Node 24 is used by Docker and CI; supported local runtimes are Node >=22.12 and <27.

## Development

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env`. Generate independent random secrets for the four secret variables; set a strong admin password and the SMS provider credentials/template IDs.
3. Start PostgreSQL and Redis: `docker compose up -d db redis`.
4. For a **new empty database**, run `npx prisma migrate deploy`. For an existing installation, follow [the migration runbook](docs/runbook/migration-backup-restore.md) first.
5. Run `npm run dev` and, in a second terminal, `npm run worker`.

The application uses http://localhost:3000. The worker runs independently, publishes the database outbox to Redis, retries notification delivery and performs hourly maintenance. OTP delivery stays synchronous, with a provider timeout.

For a full container deployment, configure `.env` and run `docker compose up -d --build`. Startup only applies migrations. It never resets or pushes the schema. The worker waits for the application's database/Redis health check. Uploaded avatars are stored in the existing uploads volume.

## Security and reservation guarantees

- OTP issuance, lock counters, consumption and protected actions use PostgreSQL transactions and per-phone/purpose locks. New OTPs supersede old ones.
- Booking mutations lock all participating user IDs in a fixed order. Both host and guest conflicts are checked under those locks.
- Partial unique database indexes prevent two confirmed bookings on one slot and multiple confirmed bookings by one guest within a schedule. Canceled reservations are retained and can be rebooked.
- User JWTs are checked against the current user/session version. Password changes revoke old sessions. Admin cookies contain random tokens backed by expiring, revocable database sessions.
- Image bytes must have a supported raster signature and decode successfully. Avatars are re-encoded as JPEG. Legacy SVGs are never served by the avatar API; the public uploads directory is sandboxed.
- Cache errors are best effort. Rate-limit failures return 503; they never silently disable security checks. Forwarded IP headers are trusted only when explicitly configured. Without a trusted ingress, requests share a conservative anonymous IP bucket; phone/user limits remain independent.
- HTTP JSON bodies and individual input collections are bounded. Availability is read from PostgreSQL, not cached booking flags.
- See [dependency review](docs/security/dependencies.md) for remaining upstream advisories and unavailable patched packages.

## Tests

The test database and Redis namespace are isolated from `.env`. They use port 55432/database `bookhub_test` and port 56379/Redis DB 1. Custom test URLs must use a database name ending in `_test` and a nonzero Redis DB. Tests erase records only in these dedicated stores.

```sh
npm run test:infra
npm run test:migrate
npx playwright install chromium firefox webkit
npm run check
```

`npm run check` runs lint with zero warnings, strict type checking, unit/component/integration tests with coverage, a production build and browser tests. Browser tests use the actual standalone production server plus an isolated local SMS provider. They never send real SMS messages.

- `npm run test:unit`: Vitest and React Testing Library.
- `npm run test:integration`: real PostgreSQL and Redis, including concurrent booking/OTP requests and a real BullMQ worker.
- `npm run test:coverage`: all unit/component/integration tests, with HTML and LCOV reports in `coverage/`.
- `npm run test:e2e`: Playwright Chromium, Firefox, WebKit and mobile Chromium. On Windows, installed Chrome is used if bundled Chromium is unavailable.
- `npm run openapi:generate`: regenerate the contract for every implemented API operation.

Coverage is measured for libraries, services, shared state and dashboard utilities; browser tests cover pages and UI flows separately. Passing tests does not prove absence of all defects, production-provider delivery, arbitrary infrastructure failures or every assistive technology/browser/device combination.

GitHub Actions runs on **every push and pull request** with PostgreSQL/Redis services, all test layers, the production build and contract-drift validation. Failure screenshots, videos, traces and coverage are retained as artifacts.

## Background delivery and retention

Notification rows are written in the same transaction as the booking. A Redis outage therefore cannot lose the intent to send a message. The worker publishes each row with a stable BullMQ job ID, rechecks cancellation/preferences before delivery, and retries up to five times with exponential backoff. Each recipient has a separate job, so one recipient's failure does not resend to the other.

Delivery is **at least once**: if the provider accepts a message and the process crashes before recording success, a later retry can duplicate that external SMS. An absolute exactly-once guarantee requires idempotency support from the provider. Success records and database locks suppress ordinary duplicate/concurrent processing.

Completed/canceled booking history is retained. Maintenance removes only unused old slots, expired security records and expired admin sessions. Explicit user deletion of a schedule or account still removes that user's owned data through the existing cascade rules.

Failed delivery rows retain attempts and `lastError` in `NotificationJob`; Redis retains failed jobs for 30 days. After correcting provider configuration, use the recovery procedure in [the incident runbook](docs/runbook/incident-recovery.md).
