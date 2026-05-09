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

Status: pending.

## D4. Cron-Triggered Flow

Status: pending.
