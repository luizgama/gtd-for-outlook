# Backlog

### Current Gate

**Next Phase: Steps 2-4 — Security, GTD Logic, Pipeline (Foundation Modules)**

Temporary handoff plans may use the ignored root `NEXT_PHASE_PLAN.md` file when needed. All implementation tasks for this phase should preserve dependency ordering and test-first requirements.

Steps 1, 5, and partial Step 6 are complete. Steps 2-4 form the critical path to end-to-end flow.
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

- [ ] Create test fixtures: normal emails in EN, PT, ES
- [ ] Create test fixtures: injection attempts in EN, PT, ES, multilingual
- [ ] Write tests for `security/sanitizer.ts`
- [ ] Write tests for `security/detector.ts`
- [ ] Write tests for `security/guardrails.ts`
- [ ] Implement `security/sanitizer.ts` — structural input cleaning
- [ ] Implement `security/detector.ts` — dual-LLM injection detection
- [ ] Implement `security/schemas.ts` — TypeBox classification schema
- [ ] Implement `security/guardrails.ts` — post-classification validation

### Step 3: GTD Business Logic (Tests First)

- [ ] Write tests for `gtd/classifier.ts`
- [ ] Write tests for `gtd/categories.ts`
- [ ] Write tests for `gtd/warnings.ts`
- [ ] Implement `gtd/categories.ts` — GTD category definitions & folder names
- [ ] Implement `gtd/prompts.ts` — multilingual classification prompts
- [ ] Implement `gtd/classifier.ts` — classification decision tree
- [ ] Implement `gtd/warnings.ts` — high-importance first-time warnings
- [ ] Implement `gtd/review.ts` — weekly review generator

### Step 4: Volume Processing Pipeline (Tests First)

- [ ] Write tests for `pipeline/state.ts`
- [ ] Write tests for `pipeline/triage.ts`
- [ ] Write tests for `pipeline/dedup.ts`
- [ ] Write tests for `pipeline/limits.ts`
- [ ] Write tests for `pipeline/batch-processor.ts`
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
