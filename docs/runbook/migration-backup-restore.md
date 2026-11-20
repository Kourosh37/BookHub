# Migration, backup and restore

Never run db push, migrate reset, or accept-data-loss against an existing installation. Startup executes migrate deploy once and exits on failure.

## Empty database

Run npm ci, configure the database URL and run:

```sh
npx prisma migrate deploy
```

The initial migration creates the original tables; the existing audit migration and the new booking/security/outbox migration follow it. CI exercises this exact sequence on a fresh PostgreSQL 16 database. A partial unique index enforces one confirmed booking per slot and one confirmed booking per guest/schedule, while canceled history remains available.

## Existing installation

1. Stop writes and take a verified backup before changing migration metadata.
2. Compare the database with the committed legacy schema:

```sh
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/legacy-schema.prisma --exit-code
```

Exit 0 means the structures match; exit 2 means differences require inspection. Do not baseline a mismatched database.

3. Check for duplicate guest/schedule reservations left by the old race condition:

```sql
SELECT "scheduleId", "bookedByUserId", count(*), array_agg(id)
FROM "Booking"
WHERE "bookedByUserId" IS NOT NULL
GROUP BY "scheduleId", "bookedByUserId"
HAVING count(*) > 1;
```

Resolve duplicates with the affected users before the new unique index is applied. The migration deliberately fails rather than silently deleting/canceling customer reservations.

4. Inspect _prisma_migrations. For a matching legacy database, mark ONLY the historical migrations not already recorded as applied:

```sh
npx prisma migrate resolve --applied 20260518000000_initial
npx prisma migrate resolve --applied 20260519152620_add_admin_panel_sms
npx prisma migrate resolve --applied 20260520120000_stability_security_audit
npx prisma migrate deploy
```

The first three resolve commands are metadata operations for an existing verified schema, not commands for an empty database. Never mark the new security/outbox migration applied manually.

5. Configure fresh strong secrets, launch the app and worker, and verify /api/health. Existing legacy user/admin cookies are invalidated by the new session formats, so users must sign in again.

## Backup and rollback

Use pg_dump in custom format and test pg_restore into a separate database. Keep backups outside container writable layers; include the avatars volume if those files must survive restoration. Choose retention and point-in-time recovery according to operational requirements.

Prefer a forward corrective migration. Never drop booking history or remove the outbox to recover a deployment. The new migration changes the one-to-one slot relationship to a history-preserving one-to-many relationship; deploying old application code against the new schema requires a compatibility review.

## Retention

Completed and canceled reservations are retained. Hourly maintenance removes unused slots older than UNBOOKED_SLOT_RETENTION_DAYS (default 30), OTP records older than OTP_RETENTION_DAYS after expiry (default 7), expired attempt records and expired admin sessions. Explicit schedule/account deletion retains its existing cascade semantics.
