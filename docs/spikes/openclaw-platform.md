# Spike A: OpenClaw Platform

This is the working log for validating OpenClaw assumptions before production implementation.

## Environment

- Date: 2026-05-07
- Node.js: `v22.22.2`
- OpenClaw CLI path: `/home/luizgama/.npm-global/bin/openclaw`
- OpenClaw version: `2026.5.3-1`
- Install source observed: global npm package at `/home/luizgama/.npm-global/lib/node_modules/openclaw`
- Peer dependency warnings: none observed from `npm list -g --depth=0 openclaw`

## A1. Install & Start Gateway

Status: done by prior local installation, per project owner direction.

Evidence captured:

```text
$ command -v openclaw
/home/luizgama/.npm-global/bin/openclaw

$ npm list -g --depth=0 openclaw
/home/luizgama/.npm-global/lib
└── openclaw@2026.5.3-1

$ node -v
v22.22.2
```

Sandbox note: running OpenClaw commands inside this Codex workspace attempts to write health state under `~/.openclaw`, which is outside the writable roots and fails with `EROFS`. Use an approved run or a writable `HOME`/state directory for the remaining runtime checks.

## A2/A4 Spike Plugin

The throwaway plugin lives in `spikes/openclaw-platform/`.

It registers:

- `echo_tool`: `Type.Object({ input: Type.String() })`
- `typed_echo_tool`: `Type.Object({ message: Type.String(), count: Type.Number(), mode: Type.Union([Type.Literal("brief"), Type.Literal("full")]), tag: Type.Optional(Type.String()) })`

The plugin intentionally imports from the installed OpenClaw package path for local validation. Replace this with regular package imports once the project locks OpenClaw and TypeBox dependencies in `package.json`.

Local module load evidence:

```text
$ node -e "const m=await import('./spikes/openclaw-platform/index.mjs'); const tools=[]; m.default.register({registerTool:t=>tools.push(t)}); console.log(JSON.stringify({id:m.default.id, tools:tools.map(t=>({name:t.name, required:t.parameters.required, properties:Object.keys(t.parameters.properties ?? {})}))}, null, 2));"
{
  "id": "gtd-outlook-spike-a",
  "tools": [
    {
      "name": "echo_tool",
      "required": ["input"],
      "properties": ["input"]
    },
    {
      "name": "typed_echo_tool",
      "required": ["message", "count", "mode"],
      "properties": ["message", "count", "mode", "tag"]
    }
  ]
}
```

OpenClaw runtime inspect evidence:

```text
$ HOME=/tmp/gtd-openclaw-home2 openclaw plugins install --link ./spikes/openclaw-platform/index.mjs
Linked plugin path: /home/luizgama/projects/github/gtd-for-outlook/spikes/openclaw-platform/index.mjs
Restart the gateway to load plugins.

$ HOME=/tmp/gtd-openclaw-home2 openclaw plugins inspect gtd-outlook-spike-a --json --runtime
status: loaded
toolNames: ["echo_tool", "typed_echo_tool"]
diagnostics: []
```

Status: A2 and A4 passed.

A4 runtime validation used the real OpenClaw profile with `tools.profile=coding` and `tools.allow=["echo_tool","typed_echo_tool"]`.

Successful valid invocation:

```text
$ openclaw agent --agent main --message "Use typed_echo_tool exactly once with message 'schema-ok', count 3, mode 'brief', tag 'A4-valid'. Return only the tool result." --session-id spike-a4-valid --json --timeout 120
payload: {"message":"schema-ok","count":3,"mode":"brief","tag":"A4-valid"}
provider: openai-codex
model: gpt-5.5
toolSummary.calls: 1
toolSummary.tools: ["typed_echo_tool"]
toolSummary.failures: 0
```

Invalid `count` and invalid `mode` were rejected by parameter validation:

```text
$ openclaw agent ... --session-id spike-a4-invalid-count
finalAssistantVisibleText: "Validation error: `count` must be a number."
toolSummary.calls: 1
toolSummary.tools: ["typed_echo_tool"]
toolSummary.failures: 1

$ openclaw agent ... --session-id spike-a4-invalid-mode
finalAssistantVisibleText: "The tool call was rejected.\n\nValidation error:\n- `mode`: must be equal to constant\n- `mode`: must be equal to constant\n- `mode`: must match a schema in anyOf"
toolSummary.calls: 1
toolSummary.tools: ["typed_echo_tool"]
toolSummary.failures: 1
```

## A3. Agent to Tool Invocation

Status: passed.

Initial blocker: the first run used an isolated temporary `HOME=/tmp/gtd-openclaw-home2`, so it did not see the real OpenClaw auth profile. Running against the real OpenClaw profile used the configured `openai-codex/gpt-5.5` model.

The correct command shape is:

```text
$ openclaw agent --agent main --message "Use echo_tool with input 'hello' and return the result." --session-id spike-a3-allow-echo --json --timeout 120
```

Additional setup needed for the real profile:

- Link the spike plugin into the real OpenClaw profile.
- Use the plugin directory in `plugins.load.paths` so OpenClaw can read `openclaw.plugin.json`.
- Remove the stale `plugins.entries.index` entry created by installing the direct `index.mjs` path.
- Refresh the plugin registry with `openclaw plugins registry --refresh --json`.
- Keep `tools.profile` as `coding` and set `tools.allow` to include `echo_tool` and `typed_echo_tool` for the A3/A4 verification runs.

Successful result:

```text
$ openclaw agent --agent main --message "Use echo_tool with input 'hello' and return the result." --session-id spike-a3-coding-allow --json --timeout 120
payload: "hello"
provider: openai-codex
model: gpt-5.5
toolSummary.calls: 1
toolSummary.tools: ["echo_tool"]
toolSummary.failures: 0
```

## A5/A6. `llm-task` JSON and Tool Isolation

Status: blocked.

`llm-task` can be enabled and inspected:

```text
$ openclaw config set plugins.entries.llm-task.enabled true
$ openclaw plugins inspect llm-task --json --runtime
status: loaded
toolNames: ["llm-task"]
optional: true
```

The gateway tool catalog also lists `llm-task` under `plugin:llm-task`. However, direct invocation through the Gateway RPC does not work in this install:

```text
$ openclaw gateway call tools.invoke --json --timeout 90000 --params '{"name":"llm-task","agentId":"main","args":{...}}'
{
  "ok": false,
  "toolName": "llm-task",
  "error": {
    "code": "not_found",
    "message": "Tool not available: llm-task"
  }
}
```

Agent-mediated invocation also did not complete. A minimal `llm-task` request reached embedded execution and then timed out:

```text
$ openclaw agent --agent main --message "Use llm-task exactly once ..." --session-id spike-a5-minimal --json --timeout 300
[agent/embedded] embedded run timeout: runId=spike-a5-minimal sessionId=spike-a5-minimal timeoutMs=300000
```

Config finding: OpenClaw rejects setting both `tools.allow` and `tools.alsoAllow` in the same scope. For the A5 test window, switching to `tools.alsoAllow=["echo_tool","typed_echo_tool","llm-task"]` avoided the config conflict but did not make `llm-task` directly invokable.

Production implication: do not depend on bundled `llm-task` for JSON-only classification or tool isolation until this invocation path is resolved. A6 remains blocked by A5.

After this blocked test, `plugins.entries.llm-task.enabled` was set back to `false`.

## A7. Sub-Agent Orchestration

Status: passed.

Current agent config has only `main`:

```text
$ openclaw agents list --json
[
  {
    "id": "main",
    "model": "openai-codex/gpt-5.5",
    "isDefault": true
  }
]
```

The parent can still coordinate dynamic child sessions via `sessions_spawn`/`sessions_yield`:

```text
$ openclaw agent --agent main --message "A7 validation: spawn two sub-agent sessions..." --session-id spike-a7-parent --json --timeout 240
toolSummary.calls: 3
toolSummary.tools: ["sessions_spawn","sessions_yield"]
toolSummary.failures: 0
stopReason: end_turn

$ openclaw agent --agent main --message "Continue A7 validation..." --session-id spike-a7-parent --json --timeout 240
payload: {"agentA":"Agent-A saw alpha","agentB":"Agent-B received: Agent-A saw alpha"}
provider: openai-codex
model: gpt-5.5
```

Production implication: separate named Capture/Clarify/Organize agents are not required just to prove parent-to-child orchestration. They may still be useful for separate workspaces, identities, or tool policies.

## A8. Cron Scheduler

Status: partially validated; plugin-tool execution is blocked.

The scheduler can create, persist, and fire an interval job:

```text
$ openclaw cron add --name spike-a8-cron --every 1m --agent main --message "A8 validation: use echo_tool with input 'cron-a8' and return the result." --session isolated --tools echo_tool --json
id: 6bd8b296-753a-4041-8b83-8d5e523daba0
schedule.everyMs: 60000
state.nextRunAtMs: 1778216855846

$ openclaw cron status --json
enabled: true
storePath: /home/luizgama/.openclaw/cron/jobs.json
jobs: 3
```

The job appeared in `~/.openclaw/cron/jobs.json` and fired repeatedly. Each run failed before agent execution because cron's runtime tool allow-list could not resolve the plugin tool:

```text
$ openclaw cron runs --id 6bd8b296-753a-4041-8b83-8d5e523daba0
status: error
error: "Error: No callable tools remain after resolving explicit tool allowlist (runtime toolsAllow: echo_tool); no registered tools matched. Fix the allowlist or enable the plugin that registers the requested tool."
```

The temporary cron job was removed:

```text
$ openclaw cron rm 6bd8b296-753a-4041-8b83-8d5e523daba0 --json
{"ok":true,"removed":true}
```

Production implication: OpenClaw cron persistence and schedule firing are usable, but plugin-tool execution through `--tools <plugin-tool>` is not validated. Re-test with production plugin tools before relying on OpenClaw cron for unattended mailbox processing, or use an external scheduler that invokes the CLI.

## A9. Session Isolation

Status: blocked by provider quota.

The intended concurrent runs were:

```text
$ openclaw agent --agent main --message "Use echo_tool with input 'session-alpha-only' and return only the result." --session-id spike-a9-alpha --json --timeout 120
$ openclaw agent --agent main --message "Use echo_tool with input 'session-beta-only' and return only the result." --session-id spike-a9-beta --json --timeout 120
```

Both failed before model execution:

```text
FailoverError: You have hit your ChatGPT usage limit (plus plan). Try again in ~206 min.
FallbackSummaryError: All models failed (1): openai-codex/gpt-5.5: Provider openai-codex is in cooldown (all profiles unavailable) (rate_limit)
```

Production implication: session isolation remains unverified. Retry A9 after provider quota recovers.
