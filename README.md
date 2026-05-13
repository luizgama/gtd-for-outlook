# GTD for Outlook

A CLI tool that organizes your Microsoft 365 mailbox using the **Getting Things Done (GTD)** methodology, orchestrated by the **OpenClaw** AI agent framework.

## Features

- **Automated email classification** using GTD methodology (Capture, Clarify, Organize, Reflect, Engage)
- **Multi-layer prompt injection defense** — emails are untrusted input processed safely in any language
- **Volume processing** — handles thousands of emails via batching, checkpointing, metadata triage, and content-hash deduplication
- **Persistent scheduling** — automatic inbox processing via OpenClaw cron
- **Token caching** — authenticate once, run unattended

## Status

**Production handoff ready (pre-tag)** — core security/GTD/pipeline/plugin/CLI modules are implemented and test-covered, with release validation and operator runbooks prepared. Remaining release action is final tag publication.

See [docs/BACKLOG.md](docs/BACKLOG.md) for the full task list and [docs/plan.md](docs/plan.md) for the implementation plan.

## Production Handoff

For production installation, OpenClaw setup, and real inbox validation, use:

- [docs/PRODUCTION_HANDOFF_RUNBOOK.md](docs/PRODUCTION_HANDOFF_RUNBOOK.md)
- [docs/RELEASE_HANDOFF_V0.1.0.md](docs/RELEASE_HANDOFF_V0.1.0.md)
- [docs/openclaw-agent-reference.md](docs/openclaw-agent-reference.md)

## Prerequisites

- Node.js 22+
- A Microsoft 365 account
- An Azure App Registration with `Mail.ReadWrite` permissions
- OpenClaw CLI installed and authenticated

## Quick Start

```bash
# Clone and install
git clone https://github.com/luizgama/gtd-for-outlook.git
cd gtd-for-outlook
npm ci
npm run build

# Configure Azure credentials
cp .env.example .env
# edit .env with GRAPH_CLIENT_ID and GRAPH_TENANT_ID
gtd-outlook setup

# Process your inbox
gtd-outlook process --agent

# Set up automatic processing every 30 minutes
gtd-outlook schedule --every 30m
```

## OpenClaw Setup

Use this section to set up the GTD Orchestrator flow end-to-end in one pass.

### 1) Set Environment Variables

Create `.env` in the repo root:

```bash
cp .env.example .env
```

Set these required values:

```bash
GRAPH_CLIENT_ID=<your-azure-app-client-id>
GRAPH_TENANT_ID=<your-azure-tenant-id-or-common>
```

Optional Graph request logging for troubleshooting:

```bash
export LOG_GRAPH_API_TO_FILE=true
export LOG_GRAPH_API_FILE_PATH=/tmp/gtd-for-outlook/graph-api.log
```

Then run first-time auth setup:

```bash
gtd-outlook setup
```

### 2) Install/Enable the OpenClaw Plugin

Refresh plugin registry and inspect runtime:

```bash
openclaw plugins registry --refresh --json
openclaw plugins inspect gtd-outlook --json --runtime
```

Expected runtime output includes:
- `status: loaded`
- `toolNames` contains `gtd_fetch_emails`, `gtd_classify_email`, `gtd_organize_email`, `gtd_sanitize_content`, `gtd_weekly_review`

If the plugin runtime entry is missing, rebuild and re-run inspect:

```bash
npm run build
openclaw plugins inspect gtd-outlook --json --runtime
```

### 3) Configure the GTD Orchestrator Agent Tool Access

Enable `llm-task` and allow GTD tools in the active tool profile:

```bash
openclaw config set plugins.entries.llm-task.enabled true
openclaw config unset tools.allow
openclaw config set tools.alsoAllow '["gtd_fetch_emails","gtd_classify_email","gtd_organize_email","gtd_weekly_review","llm-task"]' --strict-json
```

Validate effective tools:

```bash
openclaw gateway call tools.catalog --json --params '{"agentId":"main"}'
openclaw gateway call tools.effective --json --params '{"agentId":"main","sessionKey":"agent:main:main"}'
```

Use [`openclaw/AGENTS.md`](openclaw/AGENTS.md) as the GTD Orchestrator behavior contract for the `main` agent.

### 4) Run the GTD Orchestrator

Manual validation run:

```bash
openclaw agent --agent main --message "Process my inbox using GTD. Use gtd_fetch_emails, then gtd_classify_email for each email, then gtd_organize_email. Return a compact summary." --session-id gtd-orchestrator-smoke --json --timeout 180
```

Or run via CLI:

```bash
gtd-outlook process --agent
```

### 5) Enable Scheduling (Optional)

```bash
gtd-outlook schedule --every 30m
```

### Troubleshooting

- Missing env vars: verify `.env` has `GRAPH_CLIENT_ID` and `GRAPH_TENANT_ID`, then run `gtd-outlook setup` again.
- Plugin not loaded: run `openclaw plugins registry --refresh --json` and `openclaw plugins inspect gtd-outlook --json --runtime`.
- Tool not callable in agent run: verify `tools.effective` contains GTD tools and `llm-task`; if not, fix `tools.alsoAllow`.
- Graph ID errors (folder/message mismatch): ensure organize flow uses `POST /me/messages/{messageId}/move` with folder `destinationId` (fixed in current codebase).

## Commands

```
gtd-outlook process                   # Full GTD pipeline: Capture, Clarify, Organize
gtd-outlook process --agent           # Route process run through OpenClaw agent runtime
gtd-outlook process --batch-size 100  # Process 100 emails per batch
gtd-outlook process --max-emails 500  # Cap total emails this run
gtd-outlook process --since 2026-05-01 # Process emails since a given date
gtd-outlook process --backlog         # First-time backlog migration
gtd-outlook capture                   # Only fetch new emails
gtd-outlook clarify                   # Only classify fetched emails
gtd-outlook organize                  # Only move classified emails
gtd-outlook review                    # Generate weekly review
gtd-outlook cache stats               # Show local cache file metrics
gtd-outlook cache clear               # Clear local classification cache file
gtd-outlook status                    # Show gateway/scheduler runtime status
gtd-outlook schedule --every 30m      # Auto-process every 30 minutes
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/plan.md](docs/plan.md) for detailed architecture documentation.

```mermaid
flowchart TD
  CLI[gtd-outlook CLI] --> OC[OpenClaw Gateway + Agent Runtime]
  OC --> PL[GTD Plugin Tools]
  PL --> GTD[GTD Classifier/Pipeline]
  GTD --> SEC[Sanitizer + Detector + Guardrails]
  PL --> GRAPH[Microsoft Graph API Layer]
  GRAPH --> M365[Microsoft 365 Mailbox]
```

## Security

Email content is treated as **untrusted input** that may contain prompt injection attacks in any language. The system uses a 6-layer defense strategy:

1. Structural sanitization (language-agnostic)
2. Dual-LLM injection detection (multilingual)
3. Sandboxed classification via `llm-task` (JSON-only, no tools)
4. Schema validation (TypeBox)
5. Post-classification guardrails
6. Structural prompt design

See [docs/specs/06-prompt-injection.md](docs/specs/06-prompt-injection.md) for details.

## LLM Model Note

This codebase keeps classifier/detector integrations model-agnostic at the code level (dependency-invoked boundaries with mocked tests).  
For production runtime, this phase targets `gpt-5` through the OpenClaw `llm-task` boundary.

## OpenClaw inside Docker Sandbox

Docker Sandboxes run AI coding agents in isolated microVM sandboxes. Each sandbox gets its own Docker daemon, filesystem, and network — the agent can build containers, install packages, and modify files without touching your host system.

See [https://docs.docker.com/ai/sandboxes/](https://docs.docker.com/ai/sandboxes/) to learn more

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines.

## License

MIT - see [LICENSE](LICENSE)
