# Spike D: End-to-End MVP Flow

Working log for end-to-end MVP validation.

## Environment

```text
Date: 2026-05-09
Node.js: v22.22.2
Graph account: Microsoft 365 work/school mailbox
Model path: openclaw llm-task -> openai-codex / gpt-5.5
```

## D1. Single Email Classification

Status: passed.

Acceptance:

- Auth -> Fetch 1 email -> Sanitize -> `llm-task` classification -> schema-valid JSON output.

Validation command:

```bash
node spikes/end-to-end/d1-classify-single.mjs
```

Evidence:

```text
messageId: AAMk...uYWAAA=
subject: *Lembrete* Contratos 123milhas enviou um documento para você assinar como testemunha: Contrato Arvvo pdf
classification.category: @Action
classification.confidence: 0.96
```

Notes:

- `llm-task` schema + prompt were aligned to normalize category output into GTD folder naming (`@Action`, `@WaitingFor`, `@SomedayMaybe`, `@Reference`).

## D2. Single Email Organization

Status: passed.

Acceptance:

- Classify target category -> ensure folder exists -> move email -> apply category.

Validation command:

```bash
node spikes/end-to-end/d2-organize-single.mjs
```

Evidence:

```text
actionFolderCreated: false
movedToAction: true
categoryApplied: true
verifiedCategories: [ "GTD: Action" ]
```

Notes:

- Uses validated `@Action` folder convention and `GTD: Action` category.
- Move verification checks message `parentFolderId` after move and category persistence after patch.

## D3. Agent-Orchestrated Flow

Status: blocked in current environment.

Acceptance:

- Natural language -> OpenClaw agent -> `gtd_fetch_emails` -> `gtd_classify_email` -> `gtd_organize_email`.

Validation attempts:

```bash
openclaw gateway call tools.catalog --json --params '{"agentId":"main"}'
openclaw agent --agent main --message "D3 validation: call gtd_fetch_emails and then gtd_classify_email and gtd_organize_email for one email." --session-id d3-validation
```

Evidence:

```text
Error: No callable tools remain after resolving explicit tool allowlist (tools.allow: echo_tool, typed_echo_tool, llm-task); no registered tools matched.
```

Notes:

- Current agent runtime still resolves the old explicit allow-list and does not expose `gtd_*` tools.
- `tools.catalog` currently reports only `echo_tool`, `typed_echo_tool`, and `llm-task` from plugin space.

## D4. Cron-Triggered Flow

Status: blocked in current environment.

Acceptance:

- Cron fires -> agent runs D3 path -> idempotent no-op for already organized message.

Validation attempts:

```bash
openclaw cron add --name spike-d4-validation --every 1m --agent main --message "D4 validation run: use gtd_fetch_emails then gtd_classify_email then gtd_organize_email for one email." --session isolated --json
openclaw doctor
```

Evidence:

```text
GatewayTransportError: gateway closed (1006 abnormal closure (no close frame))
Gateway not running.
WSL2 needs systemd enabled.
State directory not writable (~/.openclaw).
```

Notes:

- D4 cannot be validated until gateway runtime health is restored.
- Idempotency implementation is now available in code (`src/pipeline/state.ts` + `gtdOrganizeEmail` skip path), but cron runtime validation is pending environment recovery.
