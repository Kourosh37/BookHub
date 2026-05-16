# BookHub

BookHub is a Persian-first scheduling platform built with Next.js 14, PostgreSQL (Prisma), Redis, OTP authentication, and Docker-first operations.

## Stack
- Next.js 14 (App Router)
- React 18 + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL 16
- Redis 7
- React Query + Zustand
- Zod validation + OpenAPI generation

## Run Locally (Docker + App)
1. Start infrastructure:
```bash
docker compose up -d db redis
```
2. Push schema:
```bash
npx prisma db push
```
3. Start app:
```bash
npm run dev
```

App URL: `http://localhost:3000`

## Key Scripts
```bash
npm run dev
npm run lint
npm run build
npm run openapi:generate
```

## Environment
Use `.env.example` as baseline. Important keys:
- `DATABASE_URL`
- `REDIS_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `OTP_SECRET`
- `OTP_EXPIRES_MINUTES`
- `OTP_RESEND_COOLDOWN_SECONDS`
- `SMS_API_KEY`
- `SMS_TEMPLATE_ID`

## Docker Services
- `db` (PostgreSQL)
- `redis` (Redis)
- `app` (Next.js runtime)

## Notes
- Uploaded avatars are persisted in `public/uploads/avatars` via docker volume.
- OpenAPI JSON is generated at `openapi/openapi.json`.
- API endpoint for spec: `GET /api/openapi`.
