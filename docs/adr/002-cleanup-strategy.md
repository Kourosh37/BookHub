# ADR-002: Cleanup Strategy

Date: 2026-05-20
Status: Accepted

## Context
Expired booking cleanup ran in request-cycle and could degrade latency/reliability.

## Decision
Move cleanup to dedicated internal endpoint (`POST /api/internal/cleanup/expired`) executed by cron/worker with shared secret.

## Consequences
- User requests are isolated from cleanup cost.
- Better operational observability and retry control.
- Requires cron scheduler and secret management.
