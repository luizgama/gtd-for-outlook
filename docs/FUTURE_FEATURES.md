# Future Features

Features planned for post-v0.1.0 releases. These are documented here to guide architecture decisions without being implemented prematurely.

## 1. Multi-Provider Email Support

Connect to Gmail (Google API), Yahoo Mail, IMAP/SMTP generic providers via a pluggable mail adapter interface. The current Graph API layer would become one adapter behind a common `MailProvider` interface.

## 2. MCP Server Adapter

Alternative to direct Graph API using community MCP servers (e.g., `elyxlz/microsoft-mcp`). Would allow the tool to work with any MCP-compatible email server.

## 3. Web Dashboard

Browser-based UI for GTD review and email management. Could use a lightweight framework served locally or as a static site.

## 4. Mobile Notifications

Push notifications for high-importance items via OpenClaw channels (Telegram, WhatsApp). Would integrate with OpenClaw's notification system.

## 5. Shared Mailbox Support

Process shared/team mailboxes with delegated permissions. Requires additional Graph API scopes and multi-user state management.

## 6. Custom GTD Rules

User-defined classification rules (e.g., "emails from boss@company.com are always @Action"). Rules would be evaluated before LLM classification, reducing API calls.

## 7. Calendar Integration

Auto-create calendar events for emails with detected deadlines. Would use Graph API's calendar endpoints.

## 8. Graph API Change Notifications

Real-time email processing via webhooks instead of polling, preventing backlog accumulation. Requires a webhook endpoint (local server or cloud function).
