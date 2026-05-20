# Incident Runbook

## Severity Levels
- Sev1: auth/login outage, booking creation failure, data corruption.
- Sev2: degraded latency, partial admin failure.
- Sev3: non-critical UI bug.

## First Response
1. Acknowledge incident and assign owner.
2. Check API error rate, DB health, Redis health.
3. If abuse spike: tighten rate-limits and enable lock windows.
4. If DB stress: pause non-critical jobs (cleanup/export heavy tasks).

## Recovery
1. Mitigate blast radius.
2. Restore service.
3. Validate user-critical flows.
4. Publish postmortem with timeline and corrective actions.
