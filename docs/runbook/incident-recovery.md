# Incident recovery

Check GET /api/health, application logs, worker logs and PostgreSQL/Redis availability first. Do not reset production schemas or flush shared Redis databases.

## Notification failures

NotificationJob is the durable source of truth; the Redis queue is the execution mechanism. Pending rows survive Redis outages and are republished. Rows track attempts, lastError, publishedAt, sentAt and canceledAt.

1. Inspect the affected job's lastError and provider SmsLog entry.
2. Correct provider credentials/template configuration or restore connectivity.
3. A failed job can be explicitly returned to the outbox with:

```sh
npm run notifications:retry -- JOB_ID
```

The command refuses completed/canceled or already queued/active jobs. It removes only that failed Redis job and resets that one outbox row. The worker republishes it using the same stable ID. 4. Confirm sentAt or the deliberate skip/cancellation reason. The worker rechecks user/global preferences, booking cancellation and reminder expiry at delivery time.

The provider may accept an SMS immediately before a process crash. Retrying in that ambiguous case can duplicate the external message; the provider needs an idempotency API to eliminate that window.

## Security service outage

Cache operations degrade to uncached reads. Rate limits fail closed with 503 and Retry-After, so repair Redis instead of disabling checks. TRUST_PROXY_HEADERS must be enabled only behind an ingress that overwrites incoming forwarded headers.

## Booking incidents

Participant advisory locks and partial unique indexes enforce concurrent booking rules. Inspect confirmed and canceled records before making corrections; never infer booking history only from TimeSlot.isBooked. Slot claims, reservations and outbox jobs commit together.
