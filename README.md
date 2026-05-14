# BookHub

BookHub is a Persian-first scheduling platform built with Next.js 14 (App Router), PostgreSQL (Prisma), Redis, OTP authentication, queued SMS delivery, and Docker-first operations.

This repository is production-oriented and supports:
- Phone + OTP authentication
- Username/password login fallback
- Schedule creation with Jalali calendar UX
- Booking flow with transactional slot locking
- Profile management (username, password reset by OTP, avatar upload)
- Host/guest notifications and reminder queues via Redis + BullMQ
- Rate limiting on sensitive APIs
- Structured logging with request IDs
- Sentry integration for frontend/backend error reporting
- OpenAPI generation from Zod schemas

## 1) Tech Stack

### Application
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- React Query (TanStack Query)
- Zustand
- react-hook-form + zod resolver

### Backend/Data
- Prisma ORM
- PostgreSQL 16
- Redis 7
- BullMQ

### Observability & Reliability
- Pino logger
- Request ID middleware (`x-request-id`)
- Sentry (client/server/global error boundary)
- Retry-aware Docker build stages

### API Contracts
- Zod validation schemas
- OpenAPI generation with `@asteasolutions/zod-to-openapi`

## 2) Repository Layout

- `src/app` : App Router pages and API routes
- `src/lib` : core services (auth, sms, queue, rate-limit, logging, validations)
- `src/components` : shared UI and providers
- `src/store` : Zustand stores
- `src/workers` : BullMQ workers
- `prisma/schema.prisma` : data model
- `openapi/openapi.json` : generated API spec
- `scripts/generate-openapi.ts` : OpenAPI generator
- `docker-compose.yml` : app, db, redis, worker, test profile
- `Dockerfile` : multi-stage build

## 3) Runtime Services (Docker)

### Default services
- `db` : PostgreSQL
- `redis` : Redis
- `app` : Next.js runtime
- `worker` : BullMQ worker runtime

### Optional service profile
- `test` profile: containerized unit/e2e commands

## 4) Environment Variables

Use `.env.example` as the canonical reference.

### Core
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `OTP_SECRET`
- `REDIS_URL`

### OTP behavior
- `OTP_EXPIRES_MINUTES`
- `OTP_RESEND_COOLDOWN_SECONDS`

### SMS
- `SMS_API_KEY`
- `SMS_TEMPLATE_ID`

### Uploads
- `MAX_PROFILE_IMAGE_MB`

### Schema reset behavior
- `DB_RESET_ON_SCHEMA_CHANGE`

### Logging
- `LOG_LEVEL`

### Sentry
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_TRACES_SAMPLE_RATE`
- `SENTRY_REPLAY_SAMPLE_RATE`
- `SENTRY_REPLAY_ERROR_SAMPLE_RATE`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

### Rate limits
- `OTP_RATE_LIMIT_IP_MAX`
- `OTP_RATE_LIMIT_IP_WINDOW_SECONDS`
- `LOGIN_PASSWORD_RATE_LIMIT_IP_MAX`
- `LOGIN_PASSWORD_RATE_LIMIT_IP_WINDOW_SECONDS`
- `AVATAR_UPLOAD_RATE_LIMIT_USER_MAX`
- `AVATAR_UPLOAD_RATE_LIMIT_USER_WINDOW_SECONDS`

## 5) Bootstrapping

## Docker-first (recommended)

```bash
docker compose up -d --build
```

App default URL:
- `http://localhost:3000`

OpenAPI endpoint:
- `http://localhost:3000/api/openapi`

### Stop

```bash
docker compose down
```

### Full cleanup (volumes)

```bash
docker compose down -v
```

## 6) Package Manager Strategy

Project metadata is set to pnpm:
- `"packageManager": "pnpm@11.1.2"`

Docker build/runtime supports both:
- If `pnpm-lock.yaml` exists: uses `pnpm`
- Otherwise: falls back to `npm`

This keeps local flexibility while preserving deterministic container builds.

## 7) Database Behavior

Startup flow (`docker/entrypoint.sh`):
1. compute Prisma schema hash
2. run `prisma migrate deploy` with retries
3. if schema hash changed and `DB_RESET_ON_SCHEMA_CHANGE=true`, run forced reset
4. otherwise run `prisma db push --accept-data-loss`
5. start app

## 8) Auth and Security Model

### Authentication
- OTP request: `/api/auth/request-otp`
- OTP verify: `/api/auth/verify-otp`
- Password login: `/api/auth/login-password`

### Validation
All critical request payloads are Zod-validated in `src/lib/validations.ts`.

### Rate Limiting
Redis sliding-window limiter is applied to sensitive routes:
- OTP request
- Password login
- Avatar upload

### Request Tracing
Middleware injects/propagates `x-request-id`.
Pino logger uses this ID for correlated logs.

## 9) Scheduling and Booking Flow

### Host side
- Create schedules with day/range config
- Edit title
- Delete schedule
- Share public booking link

### Guest side
- Pick date
- Pick available slot
- Submit booking

### Concurrency guarantees
Slot booking uses transaction-safe update with `isBooked=false` guard to prevent double booking race conditions.

## 10) Notifications and Queue System

### Queues
- SMS queue (`sms-jobs`)
- Reminder queue (`reminder-jobs`)

### Worker
`src/workers/queues.ts` processes:
- OTP SMS jobs
- Notification SMS jobs
- Reminder jobs

### Reminder lifecycle
- Reminder job ID is stored by booking ID in Redis
- On booking cancel, reminder job is removed from queue

## 11) Avatar Pipeline

- Upload endpoint stores files in `public/uploads/avatars`
- Returned avatar URL uses API file route for stable serving
- Docker volume `appuploads` persists uploaded files across container recreation
- UI cache busting is applied after upload to force immediate refresh

## 12) State Management Strategy

### Server state
- TanStack Query for data-fetching, cache invalidation, refetch control

### UI state
- Zustand store for theme, dashboard tab, schedule filter, avatar refresh token

## 13) API Documentation

### Generate OpenAPI JSON

```bash
pnpm run openapi:generate
```

Output:
- `openapi/openapi.json`

Runtime endpoint:
- `GET /api/openapi`

## 14) Tests

Scaffold is Docker/CI-ready and local-install independent via `pnpm dlx` scripts.

### Unit

```bash
pnpm run test:unit
```

### E2E

```bash
pnpm run test:e2e
```

### Containerized test profile

```bash
docker compose --profile test up --build test
```

## 15) Observability

### Logging
- `src/lib/logger.ts`
- structured logs + request IDs

### Errors
- Sentry client config
- Sentry server config
- App Router global error capture (`src/app/global-error.tsx`)

## 16) Production Notes

- Rotate all secrets before deployment
- Never commit real SMS/Sentry credentials
- Keep Redis and DB on private networks
- Set `NEXTAUTH_URL` to actual public URL in production
- Keep `DB_RESET_ON_SCHEMA_CHANGE=false` in production unless intentional reset policy exists

## 17) Common Troubleshooting

### OTP not sending
- verify `SMS_API_KEY` and `SMS_TEMPLATE_ID`
- check worker container logs

### Avatar 404
- verify `appuploads` volume exists
- ensure app and worker use same persistent storage strategy

### Rate-limit responses (429)
- check env limits
- inspect Redis keys and request burst patterns

### Queue jobs not processed
- ensure `worker` service is running
- check Redis connectivity

## 18) Commands Reference

```bash
pnpm run lint
pnpm run openapi:generate
pnpm run worker:queues
pnpm run test:unit
pnpm run test:e2e
```

## 19) Current Status

- Lint: clean
- OpenAPI generation: enabled
- Queue workers: enabled
- Rate limits: enabled
- Sentry wiring: enabled
- Docker app/db/redis/worker: configured

