# DB Migration, Backup and Restore

## Migration Strategy
1. Create forward-only Prisma migration.
2. Run in staging, verify query plans and latency.
3. Deploy app code compatible with both old/new schema when needed.
4. Apply migration in production during low-traffic window.
5. Verify health checks and critical flows.

## Backup
- Daily full PostgreSQL backup.
- 15-minute WAL/incremental backup.
- Retention: 14 daily + 8 weekly + 6 monthly.

## Restore Drill
1. Restore latest full backup to isolated DB.
2. Replay WAL until target timestamp.
3. Run smoke tests (`auth`, `booking`, `admin`).
4. Document RTO/RPO outcome.

## Rollback
- Prefer forward-fix migration.
- Use point-in-time restore only for critical incidents.
