# Next Phase Plan (Post-Spike-B Merge on `main`)

Date: 2026-05-09

## Objective

Close remaining validation blockers, then start production implementation with the lowest-risk vertical slice.

## Current Status Snapshot

- Spike A: A1-A7 done; A8/A9 still residual blockers.
- Spike B: B1-B7 and B9-B15 done; **B8 pending**.
- Spike C: C1-C5 pending, with **C3 required** before production dependency lock.

## Recommended Next Phase

1. **Finish B8 (message pagination)**
   - Build `spikes/microsoft-graph/messages-pagination.mjs`.
   - Use `$top=5` and follow `@odata.nextLink` across multiple pages.
   - Verify no duplicates and no gaps in traversed IDs.
   - Update `docs/spikes/microsoft-graph.md` and `docs/BACKLOG.md`.

2. **Execute Spike C immediately after B8**
   - C3 first: validate pinned dependency install flow under `.npmrc` policy (`ignore-scripts=true`).
   - C1/C2/C4/C5 in sequence to finalize dependency/runtime confidence.
   - Record evidence in docs and update backlog checks.

3. **Start production code with Step 5 (Graph layer)**
   - Implement `src/graph/auth.ts` and `src/graph/client.ts` from proven spike behavior.
   - Add tests/mocks for auth cache behavior and Graph request wrapper contracts.
   - Then implement `src/graph/folders.ts` and `src/graph/emails.ts` using B9-B15 learnings.

## Why this order

- B8 + C3 are the remaining hard gates before production work can be considered stable.
- Step 5 first turns already-validated Graph spike behavior into reusable app modules.
- Security/GTD layers can then integrate against stable Graph primitives.

## Definition of Done for This Phase

- B8 marked complete with evidence.
- C1-C5 marked complete with evidence (or explicit documented blockers + decisions).
- `src/graph/auth.ts` + `src/graph/client.ts` implemented with tests passing locally.

## Next Context Kickoff Prompt

Use this exact kickoff in the next context:

`Start Phase: implement B8 message pagination validation first, update docs/backlog, then run Spike C tasks C3 -> C1 -> C2 -> C4 -> C5 with evidence updates.`
