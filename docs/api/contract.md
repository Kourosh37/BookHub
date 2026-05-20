# API Contract (Core)

## Auth
- `POST /api/auth/request-otp` -> request OTP
- `POST /api/auth/verify-otp` -> verify OTP and login/register
- `POST /api/auth/login-password` -> password login

## Profile
- `POST /api/profile/password/request-otp`
- `POST /api/profile/password/confirm`
- `POST /api/profile/delete/request-otp`
- `POST /api/profile/delete/confirm`

## Bookings
- `GET /api/bookings/my`
- `GET /api/bookings/mine`
- `POST /api/bookings/{id}/cancel`

## Internal Jobs
- `POST /api/internal/cleanup/expired` (requires `CRON_SECRET`)

## Security Rules
- Sliding window rate-limits on auth and sensitive endpoints.
- OTP lock window after repeated failed attempts.
- Admin actions are audit-logged.
