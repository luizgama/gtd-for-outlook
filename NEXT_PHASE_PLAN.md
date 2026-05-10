# Next Phase Plan (Phase E)

Date: 2026-05-09
Branch baseline: `main`
Scope: replace Step 2-4 placeholders with tested core logic so D3/D4 run on stable internal services.

## Why this phase now

D3 plugin loading and D4 runtime environment blockers were addressed previously. Reviewing the current source tree confirms that Graph access, plugin registration, plugin runtime bridge behavior, and `pipeline/state.ts` have useful coverage. The next bottleneck is more specific: TODO-only modules and empty Vitest suites in Security, GTD, and Pipeline still block reliable end-to-end behavior.

## Phase goal

Deliver a test-backed internal processing core that can classify and organize email batches deterministically, with prompt-injection defenses, budget controls, deduplication, and resumable execution state.

## Current validation snapshot

`npm test` currently fails because ten Step 2-4 test files contain no test suites:
- `tests/unit/security/sanitizer.test.ts`
- `tests/unit/security/detector.test.ts`
- `tests/unit/security/guardrails.test.ts`
- `tests/unit/gtd/categories.test.ts`
- `tests/unit/gtd/classifier.test.ts`
- `tests/unit/gtd/warnings.test.ts`
- `tests/unit/pipeline/limits.test.ts`
- `tests/unit/pipeline/triage.test.ts`
- `tests/unit/pipeline/dedup.test.ts`
- `tests/unit/pipeline/batch-processor.test.ts`

Existing Graph, plugin, integration, and `pipeline/state.ts` tests pass and should be preserved as regression coverage.

## Ordered work plan

1. Security baseline (Step 2)
   - Replace placeholder fixtures with real normal and injection email content.
   - Replace empty test files with real suites for:
     - `src/security/sanitizer.ts`
     - `src/security/detector.ts`
     - `src/security/guardrails.ts`
     - `src/security/schemas.ts`
   - Implement:
     - sanitizer hash/flags contract
     - detector adapter boundary with mocked model tests
     - guardrail rejection reasons for invalid schema, confidence, and detector/classifier contradictions
   - Exit criteria:
     - multilingual injection fixtures covered
     - detector + guardrail contradictions handled with explicit rejection reasons
     - empty security suites no longer fail Vitest collection

2. GTD classification core (Step 3)
   - Replace empty test files with real suites for:
     - `src/gtd/categories.ts`
     - `src/gtd/classifier.ts`
     - `src/gtd/warnings.ts`
     - `src/gtd/prompts.ts` (prompt stability assertions)
   - Implement:
     - prompt builders with untrusted-content boundaries
     - warning decisions without CLI interaction
     - single-email classifier using mocked detector/model dependencies
   - Exit criteria:
     - deterministic mapping from model output -> valid GTD category
     - high-importance warning behavior verified
     - classifier stays free of OpenClaw-specific runtime code

3. Pipeline primitives + orchestration shell (Step 4)
   - Preserve existing `src/pipeline/state.ts` behavior and tests.
   - Replace empty test files with real suites for:
     - `src/pipeline/triage.ts`
     - `src/pipeline/dedup.ts`
     - `src/pipeline/limits.ts`
     - `src/pipeline/batch-processor.ts`
   - Implement:
     - pure execution limit checks
     - metadata-only triage
     - SHA-256 + sql.js dedup cache
     - bounded batch processor over Graph/client-like abstractions
   - Exit criteria:
     - resumable state works across interrupted runs
     - limit enforcement prevents budget overruns
     - dedup cache avoids repeated classification calls

4. Integration checkpoint (D3/D4 readiness)
   - Wire plugin handlers to new core modules where still stubbed
   - Preserve the D3 fix:
     - `src/plugin/index.ts` exports a `definePluginEntry()` shaped plugin entry
     - `src/plugin/index.js` fails clearly with `npm run build` guidance when dist is missing
   - Preserve the D4 lesson:
     - validation must not depend on systemd being available
   - Run:
     - `npm run build`
     - `npm test` (or `npx vitest run`)
   - Validate:
     - no silent missing-tool behavior
     - clear startup/runtime errors with action guidance

## Execution rules for this phase

- Test-first for all Step 2-4 modules.
- Keep external API calls out of pure-logic unit tests.
- Preserve strict dependency order: security -> GTD -> pipeline.
- Treat Graph as an existing boundary for this phase; change Graph only for narrow adapter needs.
- Keep plugin and CLI code thin until the core modules are real.
- Land small commits per module cluster to simplify review.

## New context anchor

Starting now, implementation context is reset to:
- Focus area: `src/security/*`, `src/gtd/*`, `src/pipeline/*`
- Primary docs: `docs/BACKLOG.md`, `docs/EXECUTION_MAP.md`, this plan file
- Immediate first action in next coding pass: replace Step 2 placeholder fixtures/tests, then complete the security modules before touching plugin/CLI features.
