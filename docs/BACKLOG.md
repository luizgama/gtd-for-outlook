# Backlog

### Current Gate

**Next Phase: Phase E — Replace Step 2-4 Placeholders With Tested Core Logic**

Implementation order for this phase is strict and test-first:
1) Security contracts + detector/guardrails, 2) GTD classifier core, 3) pipeline limits/triage/dedup/batch orchestration.

Temporary handoff plans may use the root `NEXT_PHASE_PLAN.md` file when needed.

Steps 1 and 5 are complete, Step 6 has baseline tool wiring, and `pipeline/state.ts` is implemented with coverage. Remaining blockers for end-to-end reliability are concentrated in TODO-only Step 2-4 modules and empty Step 2-4 test suites.
---

## Implementation Tasks

Detailed implementation order, first interfaces, and phase gates are documented in `docs/EXECUTION_MAP.md`. Keep this file as the task inventory and progress checklist.

### Step 1: Project Scaffolding & Docs

- [x] Initialize `package.json` with exact pinned versions
- [x] Create `tsconfig.json` and `vitest.config.ts`
- [x] Create `.npmrc` with security config
- [x] Create `.gitignore` and `.env.example`
- [x] Create `LICENSE` (MIT)
- [x] Create `docs/AGENTS.md` with dependency security rules
- [x] Create `docs/CONTRIBUTING.md`
- [x] Create `docs/BACKLOG.md` (this file)
- [x] Create `docs/FUTURE_FEATURES.md`
- [x] Create `docs/ARCHITECTURE.md`
- [x] Create `docs/plan.md`
- [x] Create `docs/EXECUTION_MAP.md`
- [x] Create design spec stubs (`docs/specs/01-06`)
- [x] Create ADR stubs (`docs/adr/001`, `docs/adr/002`)
- [x] Create `README.md`
- [x] Install and lock dependencies after spike validation

### Step 2: Security Module (Tests First)

- [ ] Replace placeholder fixtures with real normal emails in EN, PT, ES
- [ ] Replace placeholder fixtures with real injection attempts in EN, PT, ES, multilingual
- [ ] Replace empty `security/sanitizer.ts` tests with real assertions
- [ ] Replace empty `security/detector.ts` tests with real assertions
- [ ] Replace empty `security/guardrails.ts` tests with real assertions
- [ ] Complete `security/sanitizer.ts` — structural input cleaning with hash/flags contract
- [ ] Implement `security/detector.ts` — injection detection adapter boundary
- [ ] Expand `security/schemas.ts` — TypeBox detection/classification schemas
- [ ] Implement `security/guardrails.ts` — post-classification validation

### Step 3: GTD Business Logic (Tests First)

- [ ] Replace empty `gtd/categories.ts` tests with real assertions
- [ ] Replace empty `gtd/classifier.ts` tests with real assertions
- [ ] Replace empty `gtd/warnings.ts` tests with real assertions
- [ ] Expand `gtd/categories.ts` — category helpers used by classifier and plugin tools
- [ ] Implement `gtd/prompts.ts` — multilingual classification prompts with untrusted-content boundaries
- [ ] Implement `gtd/classifier.ts` — protected single-email classification flow
- [ ] Implement `gtd/warnings.ts` — high-importance first-time warnings
- [ ] Implement `gtd/review.ts` — weekly review generator

### Step 4: Volume Processing Pipeline (Tests First)

- [x] Write tests for `pipeline/state.ts`
- [ ] Replace empty `pipeline/triage.ts` tests with real assertions
- [ ] Replace empty `pipeline/dedup.ts` tests with real assertions
- [ ] Replace empty `pipeline/limits.ts` tests with real assertions
- [ ] Replace empty `pipeline/batch-processor.ts` tests with real assertions
- [x] Implement `pipeline/state.ts` — checkpoint persistence
- [ ] Implement `pipeline/triage.ts` — metadata-only fast triage rules
- [ ] Implement `pipeline/dedup.ts` — content-hash deduplication (SHA-256 + sql.js SQLite)
- [ ] Implement `pipeline/limits.ts` — execution limits enforcement
- [ ] Implement `pipeline/batch-processor.ts` — orchestrate paginated processing

### Step 5: Microsoft Graph API Layer

- [x] Implement `graph/auth.ts` — MSAL with persistent private-file token cache
- [x] Implement `graph/client.ts` — authenticated Graph client with silent token refresh
- [x] Implement `graph/folders.ts` — create/list GTD folders
- [x] Implement `graph/emails.ts` — fetch, move, categorize emails
- [x] Write integration tests with mocked Graph responses

### Step 6: OpenClaw Plugin

- [x] Create `src/plugin/openclaw.plugin.json` OpenClaw plugin manifest
- [x] Implement `plugin/index.ts` tool registry surface (repo-side contract + handlers wiring)
- [x] Add `src/plugin/index.js` build bridge with clear `npm run build` fallback error
- [x] Register `gtd_fetch_emails` tool
- [x] Register `gtd_classify_email` tool
- [x] Register `gtd_organize_email` tool
- [ ] Register `gtd_weekly_review` tool
- [ ] Wire tools to Graph API, classification, and volume pipeline
- [ ] Create `openclaw/AGENTS.md`
- [ ] Create `openclaw/SOUL.md`
- [ ] Create `openclaw/TOOLS.md`
- [ ] Create skill files for each GTD phase

### Step 7: CLI Interface & Scheduling

- [ ] Implement `cli.ts` with commander commands
- [ ] Add `process` command with volume flags (`--batch-size`, `--max-emails`, `--max-llm-calls`, `--since`, `--backlog`)
- [ ] Add `capture`, `clarify`, `organize` individual commands
- [ ] Add `review` and `dashboard` commands
- [ ] Add `status` command
- [ ] Add `cache stats` and `cache clear` commands
- [ ] Add `schedule` command wrapping OpenClaw cron
- [ ] Implement `index.ts` entry point
- [ ] Wire CLI to OpenClaw agent invocation
- [ ] Add interactive setup flow for Azure credentials

### Step 8: Polish & Release

- [ ] Finalize README with setup instructions and architecture diagram
- [ ] Finalize `docs/FUTURE_FEATURES.md`
- [ ] Ensure all tests pass (`npm ci && npx vitest run`)
- [ ] Final security review of prompt injection defenses
- [ ] Audit dependency tree (`npm audit`)
- [ ] Tag v0.1.0 release
