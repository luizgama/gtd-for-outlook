# Next Phase Plan (Phase H)

Date: 2026-05-10
Branch baseline: `main`
Scope: release-candidate hardening, deterministic test reliability, and final release checklist execution.

## Why this phase now

Steps 1-7 are complete, and the project is functionally MVP-capable. The remaining work is release safety and reliability:

- Step 8 checklist items remain open.
- At least one test run exhibited timeout behavior in `tests/unit/pipeline/state.test.ts`, indicating potential nondeterminism under load.
- Release documentation and security/dependency checks need final pass before tagging.

## Phase goal

Produce a release candidate (`v0.1.0-rc`) quality state: stable tests, finalized docs, validated dependency/security checks, and ready-to-tag release artifacts.

## Ordered work plan

1. [x] Test Reliability Stabilization
   - Investigate and fix timeout/nondeterminism in `tests/unit/pipeline/state.test.ts` and nearby filesystem-sensitive tests.
   - Add deterministic test guards (timeouts/isolation) only where justified.
   - Exit criteria:
     - repeated `npm test` runs are stable in local and sandbox environments.

2. [x] Release Documentation Finalization
   - Finalize `README.md` setup/commands/architecture sections for operator use.
   - Cross-check docs consistency:
     - `docs/BACKLOG.md`
     - `docs/EXECUTION_MAP.md`
     - `docs/FUTURE_FEATURES.md`
   - Exit criteria:
     - no stale phase or TODO references for completed workstreams.

3. [x] Security + Dependency Release Checks
   - Run build/test and dependency checks:
     - `npm run build`
     - `npm test`
     - `npm audit` (when network available)
   - Record environmental blockers explicitly if audit network access fails.
   - Exit criteria:
     - all checks pass or blockers are explicitly documented with remediation path.

4. [x] Release Tag Handoff Prep
   - Update Step 8 backlog status based on completed checks.
   - Prepare release notes summary and tag handoff checklist for `v0.1.0`.
   - Exit criteria:
     - repository is ready for final release tag operation.

## Implementation guardrails

- Prefer minimal, surgical fixes for test nondeterminism.
- Do not broaden core logic scope unless required to restore deterministic behavior.
- Keep release docs concise and operator-focused.
- Preserve existing runtime fallback/error behavior for OpenClaw integration paths.

## New context anchor

Starting now, implementation context is reset to:
- Focus area: test reliability (`tests/unit/pipeline/*`), Step 8 release docs/checks, and release handoff notes.
- Primary docs: `docs/BACKLOG.md`, `docs/EXECUTION_MAP.md`, this file.
- Immediate first action in next coding pass: reproduce and fix flaky timeout behavior, then execute full release checklist.

## Execution Notes (Completed)

- Test hardening applied to `tests/unit/pipeline/state.test.ts` for deterministic temp-dir cleanup and scoped timeout.
- Documentation status aligned for Phase H in `README.md` and `docs/EXECUTION_MAP.md`.
- Release checks run successfully after upgrading `inquirer` to `9.3.8` to clear audit findings.
- Release handoff artifact created at `docs/RELEASE_HANDOFF_V0.1.0.md`.
