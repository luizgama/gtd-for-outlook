# Backlog

## Pre-Implementation Validation (MVP Spikes)

### Spike A: OpenClaw Platform (Architecture-Critical)

- [ ] A1. Install & start OpenClaw Gateway on Node.js 22+
- [ ] A2. Load a minimal plugin with `definePluginEntry` and register a dummy tool
- [ ] A3. Agent invokes registered tool and receives result (full loop)
- [ ] A4. TypeBox schema validation works with tool parameters
- [ ] A5. `llm-task` returns JSON-only output, validated against schema
- [ ] A6. `llm-task` has no access to registered tools (tool isolation)
- [ ] A7. Sub-agent orchestration (parent agent coordinates Agent-A → Agent-B)
- [ ] A8. Cron scheduler fires on schedule, persists across gateway restart
- [ ] A9. Session isolation — concurrent sessions don't share state

### Spike B: Microsoft Graph API (Integration-Critical)

- [ ] B1. Register Azure App with Mail.ReadWrite permissions
- [ ] B2. MSAL device code flow authentication
- [ ] B3. Token cache persistence — silent re-auth after restart
- [ ] B4. Token refresh — automatic refresh after expiry
- [ ] B5. Fetch emails with structured response (id, subject, sender, body)
- [ ] B6. Fetch full email body (HTML and plain text)
- [ ] B7. Access `internetMessageHeaders` (List-Unsubscribe detection)
- [ ] B8. Pagination via `@odata.nextLink`
- [ ] B9. Create mail folder with `@` prefix (e.g., `@Action`)
- [ ] B10. Create nested mail folders
- [ ] B11. List mail folders
- [ ] B12. Move email to a different folder
- [ ] B13. Apply Outlook category to email
- [ ] B14. Rate limiting behavior (429 responses, Retry-After)
- [ ] B15. Filter emails by date and order by receivedDateTime

### Spike C: Dependency Compatibility

- [ ] C1. `better-sqlite3` with `ignore-scripts=true` (or fallback to `sql.js`)
- [ ] C2. `xxhash-wasm` ESM import on Node.js 22+ — deterministic output
- [ ] C3. `xxhash-wasm` vs `node:crypto` SHA-256 benchmark
- [ ] C4. `@sinclair/typebox` standalone schema validation
- [ ] C5. `commander` + `inquirer` interactive setup flow

### Spike D: End-to-End MVP Flow

- [ ] D1. Single email classification: Auth → Fetch → Sanitize → llm-task → Validate
- [ ] D2. Single email organization: Classify → Create folder → Move → Categorize
- [ ] D3. Agent-orchestrated flow: Natural language → agent → tools → organized email
- [ ] D4. Cron-triggered flow: Automatic processing with idempotency

---

## Implementation Tasks

### Step 1: Project Scaffolding & Docs

- [x] Initialize `package.json` with exact pinned versions
- [x] Create `tsconfig.json` and `vitest.config.ts`
- [x] Create `.npmrc` with security config
- [x] Create `.gitignore` and `.env.example`
- [x] Create `LICENSE` (MIT)
- [x] Create `docs/CLAUDE.md` with dependency security rules
- [x] Create `docs/CONTRIBUTING.md`
- [x] Create `docs/BACKLOG.md` (this file)
- [x] Create `docs/FUTURE_FEATURES.md`
- [x] Create `docs/ARCHITECTURE.md`
- [x] Create `docs/plan.md`
- [x] Create design spec stubs (`docs/specs/01-06`)
- [x] Create ADR stubs (`docs/adr/001`, `docs/adr/002`)
- [x] Create `README.md`
- [ ] Install and lock dependencies after spike validation

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
- [ ] Implement `pipeline/state.ts` — checkpoint persistence
- [ ] Implement `pipeline/triage.ts` — metadata-only fast triage rules
- [ ] Implement `pipeline/dedup.ts` — content-hash deduplication (xxhash-wasm + SQLite)
- [ ] Implement `pipeline/limits.ts` — execution limits enforcement
- [ ] Implement `pipeline/batch-processor.ts` — orchestrate paginated processing

### Step 5: Microsoft Graph API Layer

- [ ] Implement `graph/auth.ts` — MSAL with persistent encrypted token cache
- [ ] Implement `graph/client.ts` — authenticated Graph client with silent token refresh
- [ ] Implement `graph/folders.ts` — create/list GTD folders
- [ ] Implement `graph/emails.ts` — fetch, move, categorize emails
- [ ] Write integration tests with mocked Graph responses

### Step 6: OpenClaw Plugin

- [ ] Create `openclaw.plugin.json` manifest
- [ ] Implement `plugin/index.ts` with `definePluginEntry`
- [ ] Register `gtd_fetch_emails` tool
- [ ] Register `gtd_classify_email` tool
- [ ] Register `gtd_organize_email` tool
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
