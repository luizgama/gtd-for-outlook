# Next Phase Plan (Mainline Handoff)

Date: 2026-05-09

## Objective

Complete Spike D3 and D4 by wiring agent-orchestrated processing and validating unattended cron execution with idempotency.

## Current Status Snapshot

- Spike A1-A7 complete; A8/A9 still open as residual OpenClaw runtime validations.
- Spike B and C complete.
- Spike D1/D2 complete.
- Step 5 Graph layer is implemented and tested.
- Step 6 plugin/tool implementation is still mostly stubbed and is the blocker for D3/D4.

## Recommended Next Phase

1. **Implement production plugin tools (Step 6 core)**
   - Implement `src/plugin/manifest.json`.
   - Implement `src/plugin/index.ts` with `definePluginEntry`.
   - Implement tool handlers:
     - `src/plugin/tools/graph-fetch.ts`
     - `src/plugin/tools/classify-email.ts`
     - `src/plugin/tools/graph-organize.ts`
   - Tool scope for this phase: one-message or small-batch execution path that is enough to prove D3/D4.

2. **Add idempotency state for repeated runs**
   - Introduce minimal checkpoint/dedup state (hash or message-id based) used by organize flow.
   - Ensure reprocessing the same message is a no-op outcome.
   - Add focused tests around idempotent behavior.

3. **Execute and document Spike D3**
   - Trigger agent with natural-language instruction.
   - Verify agent calls plugin tools in expected order and organizes email.
   - Capture evidence in `docs/spikes/end-to-end-mvp.md`.

4. **Execute and document Spike D4**
   - Configure cron-triggered run path.
   - Validate schedule firing, post-restart persistence, and no-op on already processed items.
   - If OpenClaw cron `--tools` plugin-resolution issue persists, document runtime constraint and use validated fallback path.

5. **Close backlog status for this phase**
   - Mark D3/D4 done if validated.
   - Update A8/A9 status with final pass/fail and concrete blocker notes.

## Why this order

- D3/D4 are the only remaining end-to-end MVP gate items.
- D3 cannot pass without real plugin tools.
- D4 cannot pass without D3 path plus idempotency behavior.

## Definition of Done for This Phase

- Plugin tools are implemented and invokable by agent.
- D3 evidence recorded and backlog updated.
- D4 evidence recorded with idempotency proof and backlog updated.
- Any remaining A8/A9 blocker is reduced to a documented platform constraint with fallback.

## Next Context Kickoff Prompt

Use this exact kickoff in the next context:

`Start Step 6 implementation for Spike D3/D4: implement plugin manifest/index and tools (graph-fetch, classify-email, graph-organize), then validate agent orchestration and cron-triggered idempotent runs with evidence updates.`
