# Next Phase Plan (Phase F)

Date: 2026-05-09
Branch baseline: `main`
Scope: move from implemented core logic to usable product surface (config, CLI, scheduling flow, and release-facing docs).

## Why this phase now

The previously planned core path (security, GTD logic, pipeline primitives, plugin integration checkpoint) is now implemented and test-covered on `main` (`npm test` passes). The remaining high-impact gaps are the user/runtime entry surfaces and operational packaging:

- `src/config/constants.ts` is still TODO
- `src/config/settings.ts` is still TODO
- `src/cli.ts` is still TODO
- `src/index.ts` is still TODO

Without these, the project has strong internals but no production CLI workflow.

## Phase goal

Deliver a first usable end-to-end CLI shell that runs against the implemented core modules, with deterministic config loading, execution limits wiring, and scheduler-aware command surfaces that do not assume systemd.

## Ordered work plan

1. Config Foundations
   - Implement:
     - `src/config/constants.ts`
     - `src/config/settings.ts`
   - Include:
     - defaults for batch/limits/lookback/cache paths
     - environment + local config merge
     - required Graph auth validation
   - Exit criteria:
     - all runtime modules import shared config constants from one place
     - invalid/missing required settings fail early with actionable messages

2. CLI Skeleton and Command Surface
   - Implement:
     - `src/cli.ts`
     - `src/index.ts`
   - Add commands:
     - `process`, `capture`, `clarify`, `organize`
     - `review`, `status`
     - `schedule` (OpenClaw cron wrapper path)
   - Wire key flags:
     - `--batch-size`, `--max-emails`, `--max-llm-calls`, `--since`, `--backlog`
   - Exit criteria:
     - CLI executes help and command parsing cleanly
     - commands delegate to existing services/adapters (no business-logic duplication)

3. Scheduler and Runtime Validation Path
   - Ensure scheduling/status commands avoid systemd assumptions.
   - Use OpenClaw-compatible health/status command paths that work in sandbox/container environments.
   - Exit criteria:
     - scheduler flows provide clear actionable errors when runtime capabilities are unavailable

4. Plugin/CLI Integration Hardening
   - Align CLI commands with plugin handlers where appropriate.
   - Confirm `src/plugin/index.js` dist-bridge behavior remains actionable when unbuilt.
   - Update/extend tests for CLI and config behavior.
   - Exit criteria:
     - `npm run build` passes
     - `npm test` passes
     - CLI smoke commands run without crashing on missing optional runtime dependencies

5. Documentation and Gate Reset
   - Update:
     - `docs/BACKLOG.md` current gate to Phase F
     - `docs/EXECUTION_MAP.md` current status notes
     - `README.md` command/status sections (if command shape changed)
   - Exit criteria:
     - backlog reflects current reality (core done, CLI/config now critical path)

## Implementation guardrails

- Keep code paths deterministic and test-first where possible.
- Keep CLI thin: parse args, load settings, delegate to services.
- Do not rework core security/pipeline modules unless integration defects require it.
- Preserve D3 runtime fallback messaging and D4 environment assumptions handling.

## New context anchor

Starting now, implementation context is reset to:
- Focus area: `src/config/*`, `src/cli.ts`, `src/index.ts`, scheduler-facing command wiring
- Primary docs: `docs/BACKLOG.md`, `docs/EXECUTION_MAP.md`, this file
- Immediate first action in the next coding pass: implement config constants/settings, then CLI entry and command skeleton.
