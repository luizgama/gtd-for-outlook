# ADR 001: OpenClaw as Orchestration Framework

## Status

Accepted

## Context

We need an AI agent orchestration framework to coordinate the GTD email processing pipeline (Capture, Clarify, Organize, Reflect, Engage). The framework must support:

- Plugin-based tool registration
- Multi-agent coordination
- JSON-only sandboxed LLM calls (`llm-task`)
- Built-in cron scheduling for persistent processing
- Model-agnostic LLM integration

## Decision

Use **OpenClaw Gateway + Plugin SDK** as the orchestration layer.

## Rationale

- OpenClaw's plugin system is TypeScript-native, matching our language choice
- `llm-task` provides JSON-only sandboxed classification (critical for prompt injection defense)
- Built-in cron scheduler enables persistent, hands-off email processing
- Tool registration system maps directly to GTD operations
- Sub-agent support enables the multi-phase GTD pipeline

## Consequences

- The entire architecture depends on OpenClaw working as expected
- Must validate OpenClaw capabilities via MVP spikes before implementation
- If OpenClaw's API differs from expectations, significant rework is needed
- Python SDK is not sufficient (too thin), so TypeScript is mandatory

## Validation

See `docs/BACKLOG.md` — Spike A (A1-A9) validates all OpenClaw assumptions.
