# ADR 002: Direct Graph API Instead of MCP Server

## Status

Accepted

## Context

We need to read, move, and categorize emails in Microsoft 365 mailboxes. Two approaches were considered:

1. **Direct Graph API** via `@microsoft/microsoft-graph-client` + MSAL
2. **Community MCP servers** (e.g., `elyxlz/microsoft-mcp`)

## Decision

Use **direct Graph API integration** via `@microsoft/microsoft-graph-client`.

## Rationale

1. There is NO official Microsoft-published MCP server for Graph API
2. Community MCP servers are not officially supported — risk of abandonment
3. Direct integration gives full control over error handling, pagination, and token caching
4. A custom plugin tool gives us exactly the operations we need (no unused surface area)
5. MCP servers require their own auth setup, adding unnecessary complexity

## Consequences

- We must implement and maintain the Graph API integration layer ourselves
- Auth flow (MSAL device code + token cache) is our responsibility
- More code to write, but more control over behavior
- Future multi-provider support can add MCP adapters later

## Future

Multi-provider email support (including MCP server adapters) is documented in `docs/FUTURE_FEATURES.md` as a planned enhancement.
