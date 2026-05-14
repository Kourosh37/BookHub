# BookHub

A full-stack scheduling app built with Next.js 14, TypeScript, Prisma, PostgreSQL, Tailwind, RTL UI, and Jalali date picker.

## Setup

1. Install dependencies:
```bash
npm install
```
2. Copy env:
```bash
cp .env.example .env.local
```
3. Run database and app locally (Docker):
```bash
docker compose up --build
```
4. Or run only app in dev mode:
```bash
npx prisma migrate dev
npx prisma generate
npm run dev
```

## API Endpoints

- POST `/api/auth/request-otp`
- POST `/api/auth/verify-otp`
- POST `/api/auth/login-password`
- GET `/api/auth/me`
- POST `/api/schedules`
- GET `/api/schedules/my`
- GET `/api/schedules/:shareId`
- GET `/api/schedules/:shareId/slots?date=YYYY-MM-DD`
- POST `/api/schedules/:shareId/book`
- GET `/api/bookings/my`

## Vercel Deployment

- Set environment variables from `.env.example`
- Use PostgreSQL provider
- Build command already set in `vercel.json`

## Notes

- Booking uses transaction-safe `updateMany` with `isBooked=false` guard to prevent double booking.
- Slot uniqueness is enforced by Prisma unique index on `(scheduleId, startTime)`.
- App is exposed directly on `http://localhost:3000` in Docker Compose.
- SMS notification scaffolding exists in `src/lib/notifications.ts` (provider integration is intentionally TODO).
- Auth flow uses mobile phone + OTP (SMS sending function is scaffolded in `src/lib/sms.ts`).
- Profile APIs exist for username update, avatar upload, password change (with OTP), and account deletion.
- Docker entrypoint can reset DB on Prisma schema hash change (`DB_RESET_ON_SCHEMA_CHANGE=true`).
- Redis is integrated for OTP cooldown optimization and short-lived schedule/slots API caching.
