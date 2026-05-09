# Next Phase Plan (Phase E)

Date: 2026-05-09
Branch baseline: `main`
Scope: close the critical path for Steps 2-4 so D3/D4 can run on stable internal logic.

## Why this phase now

D3 plugin loading and D4 runtime environment blockers were addressed previously. The next bottleneck is missing implementation depth in security, GTD decisioning, and pipeline control modules. Without these, tool wiring exists but reliable end-to-end behavior does not.

## Phase goal

Deliver a test-backed internal processing core that can classify and organize email batches deterministically, with prompt-injection defenses and resumable execution state.

## Ordered work plan

1. Security baseline (Step 2)
   - Implement/complete tests for:
     - `src/security/sanitizer.ts`
     - `src/security/detector.ts`
     - `src/security/guardrails.ts`
     - `src/security/schemas.ts`
   - Exit criteria:
     - multilingual injection fixtures covered
     - detector + guardrail contradictions handled with explicit rejection reasons

2. GTD classification core (Step 3)
   - Implement/complete tests for:
     - `src/gtd/categories.ts`
     - `src/gtd/classifier.ts`
     - `src/gtd/warnings.ts`
     - `src/gtd/prompts.ts` (prompt stability assertions)
   - Exit criteria:
     - deterministic mapping from model output -> valid GTD category
     - high-importance warning behavior verified

3. Pipeline primitives + orchestration shell (Step 4)
   - Implement/complete tests for:
     - `src/pipeline/state.ts`
     - `src/pipeline/triage.ts`
     - `src/pipeline/dedup.ts`
     - `src/pipeline/limits.ts`
     - `src/pipeline/batch-processor.ts`
   - Exit criteria:
     - resumable state works across interrupted runs
     - limit enforcement prevents budget overruns
     - dedup cache avoids repeated classification calls

4. Integration checkpoint (D3/D4 readiness)
   - Wire plugin handlers to new core modules where still stubbed
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
- Land small commits per module cluster to simplify review.

## New context anchor

Starting now, implementation context is reset to:
- Focus area: `src/security/*`, `src/gtd/*`, `src/pipeline/*`
- Primary docs: `docs/BACKLOG.md`, `docs/EXECUTION_MAP.md`, this plan file
- Immediate first action in next coding pass: implement Step 2 tests and module completion before touching plugin/CLI features.
