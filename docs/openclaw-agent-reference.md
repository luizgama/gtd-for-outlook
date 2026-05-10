# OpenClaw Agent Reference

Generic notes for agents implementing or validating OpenClaw plugins, tools, skills, sub-agents, `llm-task`, and cron workflows.

Primary handoff flow for this repository:

- `docs/PRODUCTION_HANDOFF_RUNBOOK.md` for end-to-end install/configure/validate steps.
- `docs/RELEASE_HANDOFF_V0.1.0.md` for release gate and tag-readiness checklist.

## Runtime Basics

- Use the real OpenClaw profile for model and auth validation. Temporary `HOME` or isolated profile directories may hide configured auth profiles and produce misleading model-auth failures.
- Validate the installed OpenClaw and Node.js versions before debugging plugin behavior:

```bash
openclaw --version
node -v
```

- Prefer explicit JSON output for validation commands:

```bash
openclaw config get tools --json
openclaw plugins inspect <plugin-id> --json --runtime
openclaw gateway call tools.catalog --json --params '{"agentId":"main"}'
```

## Plugin Loading

- Load local plugins by directory, not by direct entry file, when the plugin has an `openclaw.plugin.json` manifest.
- If OpenClaw is configured to load a TypeScript source directory, make sure the runtime can also import JavaScript from that same directory. For a project that builds `src/plugin/index.ts` to `dist/plugin/index.js`, a small `src/plugin/index.js` bridge can re-export the compiled entry:

```js
export { default, GTD_TOOL_DEFINITIONS, pluginHandlers } from "../../dist/plugin/index.js";
```

- A typical local plugin config shape is:

```json
{
  "plugins": {
    "load": {
      "paths": ["./path/to/plugin-directory"]
    },
    "entries": {
      "plugin-id": {
        "enabled": true,
        "config": {}
      }
    }
  }
}
```

- If a direct entry file was previously installed, remove any stale synthetic plugin entry it created before re-testing.
- Refresh the registry after plugin or manifest changes:

```bash
openclaw plugins registry --refresh --json
```

- Runtime inspection should show the plugin as loaded, list expected tool names, and report no diagnostics:

```bash
openclaw plugins inspect <plugin-id> --json --runtime
```

- If runtime inspect shows `status: "loaded"` but `imported: false`, `toolNames: []`, and `shape: "non-capability"`, the manifest was discovered but the plugin entry was not imported as a capability entry. Check:
  - the entry is exported through a `definePluginEntry`-compatible shape;
  - the configured plugin directory contains an importable JavaScript runtime entry;
  - the plugin manifest declares `contracts.tools` for every registered tool;
  - `openclaw plugins registry --refresh --json` has been run after changes.

## Tool Registration

- Register tools with `definePluginEntry` and TypeBox parameter schemas.
- If the project cannot import OpenClaw's SDK as a local dependency, keep the exported entry compatible with `definePluginEntry`: include `id`, `name`, `description`, a callable `register(api)`, and a `configSchema` getter or value. OpenClaw's loader keys off this runtime shape.
- Representative schema patterns:

```ts
Type.Object({ input: Type.String() })

Type.Object({
  message: Type.String(),
  count: Type.Number(),
  mode: Type.Union([Type.Literal("brief"), Type.Literal("full")]),
  tag: Type.Optional(Type.String())
})
```

- Runtime validation should cover:
  - valid parameters succeed;
  - wrong primitive types are rejected;
  - invalid literal/union values are rejected.
- Invalid tool calls may still appear as attempted tool calls with `toolSummary.failures > 0`; that is expected when schema validation blocks execution.

## Tool Configuration

- `tools.profile` may not include plugin tools by default. Use `tools.alsoAllow` to add plugin tools to the active profile:

```json
{
  "tools": {
    "profile": "coding",
    "alsoAllow": ["tool_one", "tool_two"]
  }
}
```

- OpenClaw rejects setting both `tools.allow` and `tools.alsoAllow` in the same scope.
- `tools.allow` is restrictive. If `tools.allow` contains only plugin tool names, the active profile may be filtered down to zero effective tools in agent runs, even though `tools.catalog` lists the plugin tools.
- Use `tools.effective` to verify what an agent session can actually call:

```bash
openclaw gateway call tools.effective \
  --json \
  --params '{"agentId":"main","sessionKey":"agent:main:main"}'
```

- A common failed state is:
  - `tools.catalog` lists `plugin:<plugin-id>` and the expected tools;
  - direct `tools.invoke` succeeds;
  - `openclaw agent` fails with `No callable tools remain... no registered tools matched`;
  - `tools.effective` returns `"groups": []`.
- In that state, remove `tools.allow` and set `tools.alsoAllow` to the plugin tools while keeping `tools.profile`:

```bash
openclaw config unset tools.allow
openclaw config set tools.alsoAllow '["tool_one","tool_two"]' --strict-json
```

- If a tool appears in `tools.catalog` but is not callable, check all of these:
  - the plugin is enabled;
  - the runtime inspect status is `loaded`;
  - the tool name is included in `tools.effective`;
  - the command is using the expected agent/session scope.

## Invoking Tools

- Agent-mediated validation proves model-to-tool behavior:

```bash
openclaw agent --agent main \
  --message "Use tool_one with input 'hello' and return the result." \
  --session-id validation-tool-one \
  --json \
  --timeout 120
```

- Direct Gateway invocation is more deterministic for plugin/tool contract tests:

```bash
openclaw gateway call tools.invoke \
  --json \
  --timeout 90000 \
  --params '{"name":"tool_one","agentId":"main","args":{"input":"hello"}}'
```

- Use direct `tools.invoke` when validating tools that are themselves orchestration helpers, such as `llm-task`.
- Direct invocation can pass while agent invocation still fails. Treat direct `tools.invoke` as a plugin contract check, then use `tools.effective` plus `openclaw agent` to prove model-to-tool orchestration.

## `llm-task`

- `llm-task` is bundled but disabled by default. Enable it explicitly:

```bash
openclaw config set plugins.entries.llm-task.enabled true
```

- It is an optional plugin tool. Include it in the tool allow-list for validation:

```json
{
  "plugins": {
    "entries": {
      "llm-task": {
        "enabled": true
      }
    }
  },
  "tools": {
    "profile": "coding",
    "allow": ["llm-task"]
  }
}
```

- When validating `llm-task` alongside other plugin tools, include all required tool names in the same `tools.allow` array.
- Direct invocation pattern:

```bash
openclaw gateway call tools.invoke \
  --json \
  --timeout 90000 \
  --params '{"name":"llm-task","agentId":"main","args":{"prompt":"Return exactly {\"ok\":true} as JSON.","schema":{"type":"object","additionalProperties":false,"required":["ok"],"properties":{"ok":{"type":"boolean"}}},"provider":"openai-codex","model":"gpt-5.5","timeoutMs":30000}}'
```

- If `llm-task` returns `Tool not available`, treat it as a configuration or state issue first:
  - verify `plugins.entries.llm-task.enabled=true`;
  - verify runtime inspect lists `toolNames: ["llm-task"]`;
  - verify `tools.allow` includes `llm-task`;
  - refresh the registry or allow gateway hot reload to apply.
- If `llm-task` returns `tool execution failed`, inspect logs. A common cause is schema rejection, for example model JSON missing required keys.
- Prompts for schema validation should explicitly name every required key and the type/value constraints for each key.
- `llm-task` runs the nested embedded agent with tools disabled. That makes it appropriate for JSON-only subtasks that must not call registered tools.

## `llm-task` Tool Isolation Test

- Keep a normal plugin tool globally allowed at the same time as `llm-task`.
- Invoke `llm-task` with adversarial input requesting that tool.
- Require schema fields that report both the attempted tool request and whether a tool was actually called:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["attemptedToolCall", "toolCalled"],
  "properties": {
    "attemptedToolCall": { "type": "boolean" },
    "toolCalled": { "type": "boolean", "const": false }
  }
}
```

- Expected result:
  - the outer Gateway response is for `toolName: "llm-task"`;
  - the returned JSON is schema-valid;
  - `attemptedToolCall` is `true` for the adversarial input;
  - `toolCalled` is `false`;
  - logs show no execution of the requested plugin tool or canary payload.

## Skills And Sub-Agents

- A single `main` agent can dynamically spawn sub-agent sessions. Separate named agents are not required for basic parent-child orchestration.
- Useful tools for parent orchestration:
  - `sessions_spawn`
  - `sessions_yield`
- A typical validation flow:
  - ask the parent agent to spawn child session A;
  - pass child A's result into child session B;
  - call `sessions_yield`;
  - resume the same parent `--session-id` to collect child results.
- Named agents may still be useful when production needs separate workspaces, identities, skills, or tool policies.

## Cron

- `openclaw cron add` requires `--name`.
- Basic interval job shape:

```bash
openclaw cron add \
  --name validation-cron \
  --every 1m \
  --agent main \
  --message "Run validation task." \
  --session isolated \
  --json
```

- Useful cron commands:

```bash
openclaw cron list --json
openclaw cron status --json
openclaw cron runs --id <job-id>
openclaw cron rm <job-id> --json
```

- Scheduler persistence can be validated by checking the OpenClaw cron store path reported by `openclaw cron status --json`.
- In containers or WSL environments without systemd, `openclaw gateway restart` may report that the gateway service is disabled or that `systemctl --user` is unavailable. Start the gateway directly for validation:

```bash
openclaw gateway
openclaw gateway health --json
```

- Be careful with `--tools <plugin-tool>` on cron jobs. Runtime cron tool allow-lists may fail to resolve plugin tools when `tools.effective` does not include them. Validate production plugin-tool execution from cron before relying on it for unattended workflows.
- If cron persistence and firing work but plugin-tool execution fails, test these separately:
  - cron without `--tools`;
  - cron with profile plus `tools.alsoAllow`;
  - cron using a core tool;
  - an external scheduler that invokes a CLI command instead of relying on OpenClaw cron tool scoping.
- If `openclaw cron add` returns `GatewayTransportError: gateway closed (1006 abnormal closure)` while other gateway calls work, use the gateway cron API to isolate CLI transport issues from scheduler/runtime issues:

```bash
openclaw gateway call cron.add \
  --json \
  --params '{"name":"validation-cron","enabled":true,"agentId":"main","schedule":{"kind":"every","everyMs":60000},"sessionTarget":"isolated","wakeMode":"now","payload":{"kind":"agentTurn","message":"Call tool_one with input hello and return the result.","toolsAllow":["tool_one"],"timeoutSeconds":120},"delivery":{"mode":"none"}}'

openclaw gateway call cron.run \
  --json \
  --params '{"id":"<job-id>","mode":"force"}'

openclaw gateway call cron.runs \
  --json \
  --params '{"id":"<job-id>","limit":5}'

openclaw gateway call cron.remove \
  --json \
  --params '{"id":"<job-id>"}'
```

- Always remove temporary validation cron jobs after testing and confirm the list is clean:

```bash
openclaw cron list --json
```

## Session Isolation

- Validate isolation with distinct `--session-id` values and distinct canary inputs:

```bash
openclaw agent --agent main \
  --message "Use echo_tool with input 'session-alpha-only' and return only the result." \
  --session-id validation-alpha \
  --json \
  --timeout 120

openclaw agent --agent main \
  --message "Use echo_tool with input 'session-beta-only' and return only the result." \
  --session-id validation-beta \
  --json \
  --timeout 120
```

- Verify each transcript and tool result contains only its own canary.
- If validation fails before execution because of provider quota or model cooldown, do not mark session isolation as failed. Retry when a usable model is available.

## Practical Debugging Checklist

1. Check the plugin is enabled and loaded with `openclaw plugins inspect <plugin-id> --json --runtime`.
2. Check the tool appears in `tools.catalog`.
3. Check the configured tool policy with `openclaw config get tools --json`.
4. For deterministic contract tests, prefer `openclaw gateway call tools.invoke`.
5. Check actual agent-callable tools with `openclaw gateway call tools.effective --json --params '{"agentId":"main","sessionKey":"agent:main:main"}'`.
6. For model-to-tool behavior, use `openclaw agent`.
7. If `openclaw agent` reports no callable tools but `tools.invoke` works, fix tool policy before debugging the plugin.
8. Inspect logs after generic `tool execution failed` responses.
9. Keep validation prompts explicit about required JSON keys and allowed values.
10. Avoid simultaneous config writes; OpenClaw config writes can overwrite each other if run in parallel.
