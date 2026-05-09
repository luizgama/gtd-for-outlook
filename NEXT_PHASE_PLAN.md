# Next Phase Plan (Post-Spike-B/C Merge on `main`)

Date: 2026-05-09

## Objective

Start production implementation from validated foundations and reach a testable end-to-end MVP path.

## Current Status Snapshot

- Spike A: A1-A7 done; A8/A9 still residual blockers.
- Spike B: complete (B1-B15).
- Spike C: complete (C1-C5).
- Step 5 foundation: `src/graph/auth.ts` and `src/graph/client.ts` implemented with unit tests.
- Current validation gate: Spike D (D1-D4) remains open.

## Recommended Next Phase

1. **Complete Step 5 Graph layer**
   - Implement `src/graph/folders.ts`:
     - get/list folders
     - create folder
     - create nested child folder
   - Implement `src/graph/emails.ts`:
     - fetch paginated messages
     - fetch full body + headers
     - move message
     - apply category
   - Add mocked tests for folders/emails modules (`tests/unit/graph/*.test.ts`).

2. **Build Step 2 security module (tests first)**
   - Finalize tests for sanitizer/detector/guardrails.
   - Implement `src/security/sanitizer.ts`, `src/security/detector.ts`, `src/security/guardrails.ts`.
   - Implement `src/security/schemas.ts` with TypeBox runtime checks for classification output.

3. **Build Step 3 GTD logic module (tests first)**
   - Implement categories, prompts, classifier, and warnings.
   - Ensure outputs align with validated Graph folder/category behavior (`@Action`, `GTD: Action`).

4. **Open Spike D with minimal vertical slice**
   - D1: fetch one message -> sanitize -> classify -> validate schema.
   - D2: organize one message -> folder create/list -> move -> categorize.
   - Record evidence in docs and backlog.

## Why this order

- Graph auth/client and dependency gates are already resolved.
- Remaining risk is integration correctness across Graph modules + security + GTD logic.
- Building Graph folders/emails first keeps Spike D blocked scope small and testable.

## Definition of Done for This Phase

- `src/graph/folders.ts` and `src/graph/emails.ts` implemented with passing unit tests.
- Security and GTD core modules implemented with tests.
- D1 and D2 executed with evidence updates.

## Next Context Kickoff Prompt

Use this exact kickoff in the next context:

`Start Phase: implement graph/folders.ts and graph/emails.ts with unit tests, then complete security + GTD core modules needed for D1/D2 and run D1/D2 validation with evidence updates.`
