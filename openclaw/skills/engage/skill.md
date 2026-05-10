# Engage Skill

## Objective

Provide operator-facing next-action guidance from organized mailbox state.

## Steps

1. Load current actionable categories (`@Action`, `@WaitingFor`).
2. Prioritize by urgency and importance markers when present.
3. Surface quick-win items and deferred backlog candidates.
4. Emit concise command-line summary for user action planning.

## Boundaries

- informational guidance only; no autonomous outbound actions
- no message body mutation in this phase
