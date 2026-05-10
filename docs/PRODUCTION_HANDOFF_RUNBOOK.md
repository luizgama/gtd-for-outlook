# Production Handoff Runbook

Date: 2026-05-10
Repository: `luizgama/gtd-for-outlook`

This runbook covers end-to-end installation, OpenClaw agent/plugin setup, project configuration, execution, and real inbox validation.

## 1) Preconditions

- Node.js 22+
- OpenClaw CLI installed and authenticated
- Microsoft 365 mailbox account
- Azure App Registration with delegated `Mail.ReadWrite`

Verify local runtime:

```bash
node -v
openclaw --version
```

## 2) Clone, install, and build

```bash
git clone git@github.com:luizgama/gtd-for-outlook.git
cd gtd-for-outlook
npm ci
npm run build
```

## 3) Configure Microsoft Graph

Follow `docs/microsoft-graph-setup.md` to configure Azure.

Required outcomes:

- App registration exists.
- Public client flow is enabled.
- Delegated permission `Mail.ReadWrite` is granted/consented.
- `GRAPH_CLIENT_ID` and `GRAPH_TENANT_ID` are available.

## 4) Configure local project credentials

```bash
cp .env.example .env
```

Set:

- `GRAPH_CLIENT_ID=<client-id>`
- `GRAPH_TENANT_ID=<tenant-id-or-common>`

Then run setup:

```bash
node dist/index.js setup
```

Expected output: credentials/config saved to the local app config path.

## 5) Install/enable OpenClaw plugin and tools

Use the plugin directory containing `src/plugin/openclaw.plugin.json`.

Refresh and inspect:

```bash
openclaw plugins registry --refresh --json
openclaw plugins inspect gtd-outlook --json --runtime
```

Expected runtime indicators:

- `status` is loaded.
- `toolNames` includes:
  - `gtd_fetch_emails`
  - `gtd_classify_email`
  - `gtd_organize_email`
  - `gtd_sanitize_content`
  - `gtd_weekly_review`

If the runtime entry is missing, run:

```bash
npm run build
```

The bridge at `src/plugin/index.js` is expected to fail with that actionable instruction when dist is missing.

## 6) Configure tool allow-list for agent execution

Enable `llm-task` and include GTD tools plus `llm-task` via `tools.alsoAllow` for the active profile.

Validation:

```bash
openclaw gateway call tools.catalog --json --params '{"agentId":"main"}'
openclaw gateway call tools.effective --json --params '{"agentId":"main","sessionKey":"agent:main:main"}'
```

Expected: effective tools include the GTD tool set and `llm-task`.

## 7) Validate OpenClaw gateway and scheduler availability

```bash
openclaw gateway health --json
openclaw cron status --json
```

If systemd is unavailable in the environment, run gateway directly for session validation:

```bash
openclaw gateway
```

## 8) Functional smoke tests

Run local CLI commands:

```bash
node dist/index.js status
node dist/index.js cache stats
node dist/index.js review
```

Expected: no credential/config crashes, and cache/status output is returned.

## 9) Controlled real-inbox processing (first run)

Start with bounded parameters:

```bash
node dist/index.js process --max-emails 10 --batch-size 10 --max-llm-calls 10 --since 2026-05-01
```

Then validate agent-routed path:

```bash
node dist/index.js process --agent --max-emails 10 --batch-size 10 --max-llm-calls 10
```

Expected:

- run returns structured status/output
- no unhandled tool-registration/tool-resolution errors
- classification/organization path completes for sampled emails

## 10) Outlook mailbox validation

In Outlook, verify:

- GTD folders exist: `@Action`, `@WaitingFor`, `@SomedayMaybe`, `@Reference`, `Archive`
- processed sample emails moved to expected folders/categories
- no unexpected bulk movement

## 11) Idempotency and cache/state checks

Re-run a bounded process command. Expected outcome: already-processed messages are mostly skipped.

Cache checks:

```bash
node dist/index.js cache stats
node dist/index.js cache clear
node dist/index.js cache stats
```

## 12) Scheduler validation

Create schedule:

```bash
node dist/index.js schedule --every 30m
```

Validate:

```bash
openclaw cron list --json
openclaw cron runs --id <job-id> --json
```

Expected: job is registered and run metadata is persisted.

## 13) Production readiness acceptance checklist

- `npm run build` passes
- `npm test` passes
- `npm audit` reports no unresolved release-blocking vulnerabilities
- plugin runtime inspection shows all required GTD tools loaded
- bounded real inbox run succeeds and expected GTD foldering is observed
- scheduler run path is validated in target runtime environment

