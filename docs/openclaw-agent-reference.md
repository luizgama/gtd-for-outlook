# OpenClaw Agent Reference

Generic notes for agents implementing or validating OpenClaw plugins, tools, skills, sub-agents, `llm-task`, and cron workflows.

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

## Tool Registration

- Register tools with `definePluginEntry` and TypeBox parameter schemas.
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

- `tools.profile` may not include plugin tools by default. Use an explicit allow-list when validating plugin tools:

```json
{
  "tools": {
    "profile": "coding",
    "allow": ["tool_one", "tool_two"]
  }
}
```

- OpenClaw rejects setting both `tools.allow` and `tools.alsoAllow` in the same scope.
- If a tool appears in `tools.catalog` but is not callable, check all of these:
  - the plugin is enabled;
  - the runtime inspect status is `loaded`;
  - the tool name is included in the effective `tools.allow` or the active tool profile;
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
- Be careful with `--tools <plugin-tool>` on cron jobs. Runtime cron tool allow-lists may fail to resolve plugin tools even when those tools are globally allowed. Validate production plugin-tool execution from cron before relying on it for unattended workflows.
- If cron persistence and firing work but plugin-tool execution fails, test these separately:
  - cron without `--tools`;
  - cron with only global `tools.allow`;
  - cron using a core tool;
  - an external scheduler that invokes a CLI command instead of relying on OpenClaw cron tool scoping.

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
3. Check the effective tool configuration with `openclaw config get tools --json`.
4. For deterministic contract tests, prefer `openclaw gateway call tools.invoke`.
5. For model-to-tool behavior, use `openclaw agent`.
6. Inspect logs after generic `tool execution failed` responses.
7. Keep validation prompts explicit about required JSON keys and allowed values.
8. Avoid simultaneous config writes; OpenClaw config writes can overwrite each other if run in parallel.
