# Capture Skill

## Objective

Fetch a bounded set of unread messages for downstream GTD processing.

## Steps

1. Verify Graph auth settings are present.
2. Call `gtd_fetch_emails` with conservative `top` bound.
3. Apply optional `since` boundary when the run specifies lookback control.
4. Return structured message list for clarify stage.

## Output

- list of message metadata
- pagination cursor/next-link context if present
- count summary for run telemetry
