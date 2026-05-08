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

Status: A2 passed. A4 schema registration shape is present, but valid/invalid agent invocation is not complete yet.

## A3. Agent to Tool Invocation

Status: blocked in this environment.

Gateway startup required running outside the socket sandbox:

```text
$ HOME=/tmp/gtd-openclaw-home2 openclaw gateway run --bind lan --port 19011 --auth token --token spike-token --allow-unconfigured --verbose
[gateway] http server listening
[gateway] ready
```

Health probe passed:

```text
$ HOME=/tmp/gtd-openclaw-home2 openclaw gateway health --url ws://127.0.0.1:19011 --token spike-token --json
{
  "ok": true,
  "defaultAgentId": "main"
}
```

Agent invocation failed before tool use because the temporary state has no model auth profile:

```text
$ HOME=/tmp/gtd-openclaw-home2 openclaw agent --message "Use echo_tool with input 'hello' and return the result." --session-id spike-a3 --json --timeout 60
FailoverError: No API key found for provider "openai".
```

Next step: configure a throwaway model provider auth profile for the temporary OpenClaw state, or point the spike at an already configured OpenClaw profile, then rerun A3 and A4 through the agent.
