# Next Phase Plan (Phase G)

Date: 2026-05-09
Branch baseline: `main`
Scope: close remaining MVP blockers after core + CLI baseline delivery.

## Why this phase now

Core logic, plugin wiring, config foundations, and baseline CLI command surface are implemented and test-covered on `main` (`npm test` passes). Remaining blockers are now concentrated in:

- OpenClaw workspace assets still missing:
  - `openclaw/AGENTS.md`
  - `openclaw/SOUL.md`
  - `openclaw/TOOLS.md`
  - skill files for GTD phases
- CLI completion items still open:
  - `cache stats`
  - `cache clear`
  - interactive setup flow for Azure credentials
  - CLI to OpenClaw agent invocation path
- Release hardening/documentation closure tasks.

## Phase goal

Deliver an MVP-complete operator surface: usable CLI workflows, complete OpenClaw workspace docs/skills, and release-ready project documentation/checklists.

## Ordered work plan

1. CLI Completion Pass
   - Implement remaining Step 7 commands:
     - `cache stats`
     - `cache clear`
   - Add interactive setup flow for Azure credentials (safe local config bootstrap).
   - Add/complete command tests for new flows.
   - Exit criteria:
     - all documented CLI commands exist and return deterministic output/error paths

2. OpenClaw Workspace Completion
   - Create:
     - `openclaw/AGENTS.md`
     - `openclaw/SOUL.md`
     - `openclaw/TOOLS.md`
   - Add skill files for `capture`, `clarify`, `organize`, `reflect`, `engage`.
   - Ensure skill instructions align with implemented plugin tools and security posture.
   - Exit criteria:
     - Step 6 documentation/skills checklist items can be marked complete

3. CLI-to-Agent Invocation Wiring
   - Wire selected CLI commands to OpenClaw execution path where appropriate.
   - Keep thin adapters; avoid duplicating business logic.
   - Preserve sandbox-safe runtime behavior (no systemd assumptions).
   - Exit criteria:
     - invocation path is testable/mocked and fails with actionable errors when runtime is unavailable

4. Release Readiness Pass
   - Update README command/architecture sections to final MVP command set.
   - Run:
     - `npm run build`
     - `npm test`
   - Perform dependency/security sanity checks per backlog.
   - Exit criteria:
     - Step 8 checklist can move to final review/release tagging

## Implementation guardrails

- Prefer additive completion of remaining surfaces over refactoring stable core modules.
- Keep CLI and OpenClaw adapters thin and explicit.
- Maintain actionable runtime errors for unavailable OpenClaw/scheduler capabilities.
- Preserve D3 dist-bridge fallback semantics and security prompt boundaries.

## New context anchor

Starting now, implementation context is reset to:
- Focus area: `src/cli.ts`, `src/index.ts`, `openclaw/*`, and release-facing docs
- Primary docs: `docs/BACKLOG.md`, `docs/EXECUTION_MAP.md`, this file
- Immediate first action in next coding pass: implement `cache` command family + setup flow, then complete OpenClaw workspace docs/skills.
