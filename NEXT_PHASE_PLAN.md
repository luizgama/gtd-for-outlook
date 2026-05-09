# Next Phase Plan (Mainline Handoff)

Date: 2026-05-09

## Objective

Complete the remaining Graph application layer and execute Spike D1/D2.

## Current Status Snapshot

- Spike B and C are complete.
- `src/graph/auth.ts` and `src/graph/client.ts` are implemented and unit-tested.
- `src/graph/folders.ts` and `src/graph/emails.ts` are still pending.
- Spike D (D1-D4) is still pending.

## Recommended Next Phase

1. **Finish Step 5 Graph modules**
   - Implement `src/graph/folders.ts` with:
     - `getFolderByName`
     - `createFolder`
     - `createChildFolder`
     - `listFolders`
   - Implement `src/graph/emails.ts` with:
     - `fetchMessagesPage` (supports `nextLink`)
     - `fetchMessageBodyAndHeaders`
     - `moveMessage`
     - `applyCategories`
   - Add/replace tests:
     - `tests/unit/graph/folders.test.ts`
     - `tests/unit/graph/emails.test.ts`

2. **Bridge for D1/D2**
   - Wire minimal usage paths from graph modules into existing stubs used by integration tests.
   - Ensure return types match security/GTD pipeline needs.

3. **Execute Spike D1 and D2**
   - D1: auth -> fetch one message -> sanitize -> classify -> schema validate.
   - D2: classify -> ensure target folder -> move -> categorize.
   - Record evidence in spike docs and mark backlog checks.

## Why this order

- The remaining hard blocker for MVP proof is D1/D2.
- D1/D2 cannot be validated cleanly until Step 5 modules are productionized.
- This sequencing keeps scope narrow and measurable.

## Definition of Done for This Phase

- `src/graph/folders.ts` and `src/graph/emails.ts` implemented with passing unit tests.
- D1 and D2 marked complete in `docs/BACKLOG.md`.
- Evidence for D1/D2 captured in spike docs.

## Next Context Kickoff Prompt

Use this exact kickoff in the next context:

`Start new phase: implement src/graph/folders.ts and src/graph/emails.ts with unit tests first, then execute and document Spike D1/D2 end-to-end validations.`
