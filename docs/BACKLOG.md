# Backlog

## Current Gate

Production implementation is blocked until the MVP validation spikes below are completed and their decisions are recorded. The repository is scaffolded; use `docs/EXECUTION_MAP.md` for implementation order after this gate passes.

## Resolved MVP Decisions

- Microsoft Graph permissions: delegated `Mail.ReadWrite` only; no `Mail.Send` in the MVP.
- Token cache: MSAL cache serialized to `~/.gtd-outlook/token-cache.json` with owner-only `0600` permissions; OS keychain/encryption is future hardening.
- Content hash: `node:crypto` SHA-256; no `xxhash-wasm` dependency.
- Classification cache: SQLite via `sql.js`; no native SQLite dependency requiring postinstall scripts.
- Plugin manifest path: `src/plugin/manifest.json`.

## Pre-Implementation Validation (MVP Spikes)

### Spike A: OpenClaw Platform (Architecture-Critical)

- [x] A1. Install & start OpenClaw Gateway on Node.js 22+
- [x] A2. Load a minimal plugin with `definePluginEntry` and register a dummy tool
- [x] A3. Agent invokes registered tool and receives result (full loop)
- [x] A4. TypeBox schema validation works with tool parameters
  - Use the existing `typed_echo_tool` spike tool.
  - Run valid invocation via `openclaw agent --agent main ...` and verify `toolSummary.tools` includes `typed_echo_tool`.
  - Run invalid invocations for wrong `count` type and invalid `mode` literal; verify OpenClaw rejects or does not execute the tool.
  - Keep `tools.profile=coding` and `tools.allow=["echo_tool","typed_echo_tool"]` during this check.
- [x] A5. `llm-task` returns JSON-only output, validated against schema
  - Enable `plugins.entries.llm-task.enabled=true`.
  - Allow the optional tool for the test window using `tools.allow=["echo_tool","typed_echo_tool","llm-task"]`.
  - Use configured `openai-codex/gpt-5.5` instead of a temporary `HOME` so auth profiles are available.
  - Verify normal and adversarial email inputs return only parsed JSON conforming to schema.
  - Use direct `openclaw gateway call tools.invoke` rather than agent-mediated invocation for deterministic validation.
  - Prompt must explicitly require every schema key; otherwise `llm-task` correctly rejects schema-incomplete model JSON.
- [x] A6. `llm-task` has no access to registered tools (tool isolation)
  - Keep `echo_tool` installed and available in the agent tool list.
  - Prompt `llm-task` with adversarial input requesting `echo_tool` execution.
  - Verify `llm-task` returns schema-valid JSON and no `echo_tool` call appears in run/tool history.
  - Validated with `tools.allow=["echo_tool","typed_echo_tool","llm-task"]`; `llm-task` returned `attemptedToolCall=true` and `toolCalled=false`, and the bundled implementation invokes the embedded agent with `disableTools: true`.
- [x] A7. Sub-agent orchestration (parent agent coordinates Agent-A → Agent-B)
  - First inspect `openclaw sessions_spawn`/`subagents` behavior in the current `main` agent config.
  - Use isolated session ids for Agent-A and Agent-B and verify result handoff through the parent.
  - Record whether multiple named agents must be configured before production can rely on Capture → Clarify → Organize separation.
- [ ] A8. Cron scheduler fires on schedule, persists across gateway restart — partially validated, plugin-tool execution blocked
  - Use `openclaw cron add --every 1m --agent main --message ... --session isolated --tools echo_tool --json`.
  - Verify `openclaw cron list/status/runs` and `~/.openclaw/cron/jobs.json`.
  - Restart the gateway and confirm the job survives and fires again.
  - Clean up the test cron job after validation.
  - Current finding: scheduler persisted and fired repeatedly, but each run failed with `runtime toolsAllow: echo_tool` because plugin tools were not resolved under the cron runtime allow-list.
- [ ] A9. Session isolation — concurrent sessions don't share state — blocked by provider quota
  - Start two `openclaw agent` runs with distinct `--session-id` values and different `echo_tool` inputs.
  - Verify each session transcript contains only its own input/output.
  - Confirm no tool result or session state leaks when runs overlap.
  - Current blocker: concurrent validation runs failed before execution due `openai-codex/gpt-5.5` ChatGPT usage limit/cooldown.

Evidence: see `docs/spikes/openclaw-platform.md` for OpenClaw version, plugin loading, and A3 agent-to-tool invocation results.

### Spike B: Microsoft Graph API (Integration-Critical)

- [ ] B1. Register Azure App with delegated Mail.ReadWrite permission only
- [ ] B2. MSAL device code flow authentication
- [ ] B3. Token cache persistence — private 0600 cache file and silent re-auth after restart
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

- [ ] C1. `sql.js` with `ignore-scripts=true` — persist, reload, and query cache DB
- [ ] C2. `node:crypto` SHA-256 hashing — deterministic output and acceptable runtime
- [ ] C3. Exact pinned dependency install works under `.npmrc` security policy
- [ ] C4. `@sinclair/typebox` standalone schema validation
- [ ] C5. `commander` + `inquirer` interactive setup flow

### Spike D: End-to-End MVP Flow

- [ ] D1. Single email classification: Auth → Fetch → Sanitize → llm-task → Validate
- [ ] D2. Single email organization: Classify → Create folder → Move → Categorize
- [ ] D3. Agent-orchestrated flow: Natural language → agent → tools → organized email
- [ ] D4. Cron-triggered flow: Automatic processing with idempotency

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
- [ ] Implement `pipeline/dedup.ts` — content-hash deduplication (SHA-256 + sql.js SQLite)
- [ ] Implement `pipeline/limits.ts` — execution limits enforcement
- [ ] Implement `pipeline/batch-processor.ts` — orchestrate paginated processing

### Step 5: Microsoft Graph API Layer

- [ ] Implement `graph/auth.ts` — MSAL with persistent private-file token cache
- [ ] Implement `graph/client.ts` — authenticated Graph client with silent token refresh
- [ ] Implement `graph/folders.ts` — create/list GTD folders
- [ ] Implement `graph/emails.ts` — fetch, move, categorize emails
- [ ] Write integration tests with mocked Graph responses

### Step 6: OpenClaw Plugin

- [ ] Create `src/plugin/manifest.json` OpenClaw plugin manifest
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
