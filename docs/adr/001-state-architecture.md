# ADR-001: State Architecture

Date: 2026-05-20
Status: Accepted

## Context
UI had mixed local state patterns and duplicated/mirrored state.

## Decision
- Server state: TanStack Query only.
- Client/UI state: Zustand only.
- Form state: React Hook Form + Zod.
- Avoid mirrored state derived from query data.

## Consequences
- More predictable cache and loading state behavior.
- Less accidental re-rendering.
- Clear team conventions for new features.
