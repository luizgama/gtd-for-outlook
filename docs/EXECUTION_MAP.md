# Execution Map

This document is the implementation-order companion to `docs/BACKLOG.md`.

- `docs/BACKLOG.md` tracks what remains to be done.
- `docs/EXECUTION_MAP.md` defines how to execute the implementation, in what order, and with which first concrete interfaces.

The goal is to let an implementing engineer or agent work through the scaffolded codebase without making sequencing or interface decisions ad hoc.

## Dependency Order

The current source tree is aligned with `docs/plan.md`, but the modules are mostly placeholders. Implementation should proceed in this order:

1. Foundations
2. Pure security and GTD logic
3. Pipeline primitives
4. Microsoft Graph integration
5. Classification orchestration
6. Batch processing and plugin tools
7. CLI and review flow

This order is intentional:

- Start with internal types, schemas, constants, and config so later modules share stable contracts.
- Implement deterministic local logic before external integrations.
- Keep OpenClaw plugin wiring and CLI wiring thin by building them on top of already-tested services.

## Phase 1: Foundations

Objective: lock the core data model, configuration shape, and schema contracts used everywhere else.

Files:

- `src/config/constants.ts`
- `src/gtd/categories.ts`
- `src/security/schemas.ts`
- `src/config/settings.ts`

Prerequisites:

- None beyond the existing scaffold.

First concrete interfaces:

```ts
export const GTD_CATEGORIES = [
  "@Action",
  "@WaitingFor",
  "@SomedayMaybe",
  "@Reference",
  "Archive",
] as const;

export type GtdCategory = (typeof GTD_CATEGORIES)[number];

export type Importance = "high" | "normal" | "low";
export type EffortEstimate = "quick" | "medium" | "deep";

export interface AppSettings {
  graphClientId: string;
  graphTenantId: string;
  batchSize: number;
  maxEmailsPerRun: number;
  maxLlmCallsPerRun: number;
  lookbackDays: number;
  cacheDir: string;
  stateFilePath: string;
  classificationCachePath: string;
  autoApproveHighImportance: boolean;
}

export interface InjectionDetectionResult {
  is_injection: boolean;
  confidence: number;
  reason: string;
}

export interface ClassificationResult {
  actionable: boolean;
  category: GtdCategory;
  effort_estimate: EffortEstimate;
  requires_delegation: boolean;
  has_deadline: boolean;
  deadline_date: string | null;
  importance: Importance;
  summary: string;
  confidence: number;
  injection_flags: string[];
}
```

Implementation notes:

- `constants.ts` should define default numeric limits, default folder names, and default local storage locations.
- `categories.ts` should hold the canonical GTD unions and helpers that other modules import instead of redefining strings.
- `schemas.ts` should expose TypeBox schemas and matching static types for injection detection and classification results.
- `settings.ts` should read from environment variables and local config, apply defaults, and fail early on missing required Graph auth values.

Exit criteria:

- Every later module can import shared types and defaults from one place.
- The schema layer is stable enough for tests and tool contracts.

## Phase 2: Pure Security and GTD Logic

Objective: implement deterministic behavior that does not require Graph or OpenClaw.

Files:

- `src/security/sanitizer.ts`
- `src/security/guardrails.ts`
- `src/gtd/prompts.ts`
- `src/gtd/warnings.ts`

Prerequisites:

- Phase 1 types and schemas.

First concrete interfaces:

```ts
export interface SanitizedEmailContent {
  sanitizedContent: string;
  originalHash: string;
  flags: string[];
}

export function sanitizeEmailContent(input: string): SanitizedEmailContent;

export interface GuardrailContext {
  detection: InjectionDetectionResult;
  classification: ClassificationResult;
  recentCategories?: GtdCategory[];
}

export interface GuardrailDecision {
  accepted: boolean;
  reasons: string[];
}

export function validateClassification(
  context: GuardrailContext,
): GuardrailDecision;

export function buildInjectionDetectionPrompt(): string;
export function buildClassificationPrompt(): string;

export interface HighImportanceWarningState {
  hasWarned: boolean;
}

export function shouldWarnForHighImportanceAction(
  category: GtdCategory,
  importance: Importance,
  autoApprove: boolean,
  state: HighImportanceWarningState,
): boolean;
```

Implementation notes:

- `sanitizer.ts` should perform the structural cleaning described in `docs/plan.md`, not semantic threat detection.
- `guardrails.ts` should reject invalid categories, invalid confidence ranges, obvious echoed-content failures, and detector/classifier contradictions.
- `prompts.ts` should return stable prompt builders with XML boundaries and “untrusted content” framing.
- `warnings.ts` should contain only warning decision logic; user interaction belongs later in CLI/plugin layers.

Exit criteria:

- The security-critical pure logic is testable without any external service.
- Classification inputs and outputs are stable enough for orchestration.

## Phase 3: Pipeline Primitives

Objective: implement local state, run controls, fast triage, and dedup primitives before wiring external APIs.

Files:

- `src/pipeline/limits.ts`
- `src/pipeline/state.ts`
- `src/pipeline/triage.ts`
- `src/pipeline/dedup.ts`

Prerequisites:

- Phase 1 and Phase 2 interfaces.

First concrete interfaces:

```ts
export interface ExecutionLimits {
  batchSize: number;
  maxEmails: number;
  maxLlmCalls: number;
}

export interface ExecutionBudget {
  processedEmails: number;
  llmCalls: number;
}

export function canProcessNextEmail(
  budget: ExecutionBudget,
  limits: ExecutionLimits,
): boolean;

export interface ProcessingStateEntry {
  status: "fetched" | "classified" | "organized" | "skipped";
  classifiedAt?: number;
  hash?: string;
}

export type ProcessingState = Record<string, ProcessingStateEntry>;

export function loadProcessingState(path: string): Promise<ProcessingState>;
export function saveProcessingState(
  path: string,
  state: ProcessingState,
): Promise<void>;

export interface EmailMetadata {
  id: string;
  subject: string;
  sender: string;
  receivedAt: string;
  headers?: Record<string, string>;
}

export interface TriageDecision {
  action: "classify" | "archive" | "reference" | "someday";
  reason: string;
}

export function triageEmailMetadata(email: EmailMetadata): TriageDecision | null;

export interface DedupCacheResult {
  hit: boolean;
  classification?: ClassificationResult;
}

export function getCachedClassification(
  normalizedSubject: string,
  normalizedBody: string,
): Promise<DedupCacheResult>;

export function storeCachedClassification(
  normalizedSubject: string,
  normalizedBody: string,
  classification: ClassificationResult,
): Promise<void>;
```

Implementation notes:

- `limits.ts` should be a pure budget checker, not a CLI parser.
- `state.ts` should make resume/idempotency easy and should tolerate a missing state file on first run.
- `triage.ts` should apply only clear metadata rules described in `docs/plan.md`.
- `dedup.ts` should hide `node:crypto` SHA-256 hashing and `sql.js` cache-storage details behind a small API so classifier code stays simple.

Exit criteria:

- The project can decide whether an email should be skipped, classified, or resumed without touching Graph or OpenClaw.

## Phase 4: Microsoft Graph Integration

Objective: implement mailbox access on stable internal DTOs rather than leaking Graph SDK shapes across the app.

Files:

- `src/graph/auth.ts`
- `src/graph/client.ts`
- `src/graph/folders.ts`
- `src/graph/emails.ts`

Prerequisites:

- Phase 1 settings contracts.
- Phase 3 metadata and state concepts.

First concrete interfaces:

```ts
export interface GraphTokenProvider {
  getAccessToken(): Promise<string>;
}

export function createGraphTokenProvider(
  settings: AppSettings,
): Promise<GraphTokenProvider>;

export interface OutlookEmail {
  id: string;
  subject: string;
  sender: string;
  bodyPreview: string;
  body: string;
  receivedAt: string;
  hasAttachments: boolean;
  headers?: Record<string, string>;
}

export interface FetchEmailsOptions {
  limit: number;
  since?: string;
  folder?: string;
}

export interface GraphMailClient {
  fetchUnreadEmails(options: FetchEmailsOptions): Promise<OutlookEmail[]>;
  moveEmail(emailId: string, destinationFolderId: string): Promise<void>;
  applyCategories(emailId: string, categories: string[]): Promise<void>;
  ensureFolder(name: string): Promise<{ id: string; name: string }>;
}
```

Implementation notes:

- `auth.ts` should own device-code bootstrap, token persistence, and silent refresh.
- `client.ts` should own authenticated client creation and HTTP retry behavior for rate limiting.
- `folders.ts` and `emails.ts` should convert Graph responses into internal DTOs immediately.
- Do not let the rest of the codebase depend directly on SDK response shapes.

Exit criteria:

- The rest of the app can fetch, move, and categorize mail through narrow internal APIs.

## Phase 5: Classification Orchestration

Objective: create the central business pipeline that coordinates triage, sanitization, detection, validation, and caching.

Files:

- `src/security/detector.ts`
- `src/gtd/classifier.ts`

Prerequisites:

- Phases 1 through 4.

First concrete interfaces:

```ts
export interface InjectionDetector {
  detect(content: string): Promise<InjectionDetectionResult>;
}

export interface ClassifierDependencies {
  detector: InjectionDetector;
}

export interface ClassifyEmailInput {
  id: string;
  subject: string;
  sender: string;
  body: string;
  receivedAt?: string;
  headers?: Record<string, string>;
}

export function classifyEmail(
  input: ClassifyEmailInput,
  dependencies: ClassifierDependencies,
): Promise<ClassificationResult>;
```

Implementation notes:

- `detector.ts` should encapsulate the separate injection-detection `llm-task` call.
- `classifier.ts` should orchestrate metadata triage, sanitization, dedup lookup, detection, classification prompt construction, schema validation, and guardrails.
- Keep OpenClaw-specific invocation details out of the business pipeline where possible; isolate them in adapter-like boundaries.

Exit criteria:

- A single email can be classified through the full protected flow using only internal service interfaces.

## Phase 6: Batch Processing and Plugin Tools

Objective: turn the core services into reusable processing runs and OpenClaw tools.

Files:

- `src/pipeline/batch-processor.ts`
- `src/plugin/tools/graph-fetch.ts`
- `src/plugin/tools/classify-email.ts`
- `src/plugin/tools/graph-organize.ts`
- `src/plugin/tools/weekly-review.ts`
- `src/plugin/tools/sanitize.ts`
- `src/plugin/index.ts`

Prerequisites:

- Phases 1 through 5.

First concrete interfaces:

```ts
export interface ProcessInboxOptions {
  batchSize: number;
  maxEmails: number;
  maxLlmCalls: number;
  since?: string;
  backlog?: boolean;
  autoApprove?: boolean;
}

export interface ProcessInboxResult {
  processed: number;
  organized: number;
  skipped: number;
  remainingBudget: ExecutionBudget;
}

export function processInbox(
  options: ProcessInboxOptions,
): Promise<ProcessInboxResult>;
```

Implementation notes:

- `batch-processor.ts` should be the orchestration layer for bounded resumable runs.
- Plugin tool files should be thin wrappers that validate parameters and delegate to services.
- `plugin/index.ts` should only register tools and bind them to the already-implemented services.
- `sanitize.ts` should expose Layer 1 as a standalone inspection tool, not duplicate sanitizer logic.

Exit criteria:

- OpenClaw can call stable tool handlers backed by tested internal services.

## Phase 7: CLI and Review Flow

Objective: finish the user-facing interface after the lower layers are stable.

Files:

- `src/gtd/review.ts`
- `src/cli.ts`
- `src/index.ts`

Prerequisites:

- Phases 1 through 6.

First concrete interfaces:

```ts
export interface WeeklyReviewSummary {
  actionItems: number;
  waitingForItems: number;
  somedayItems: number;
  referenceItems: number;
  highImportanceItems: number;
  markdown: string;
}

export function generateWeeklyReview(): Promise<WeeklyReviewSummary>;
```

Implementation notes:

- `review.ts` should produce structured summary data plus a markdown representation.
- `cli.ts` should define commands and flags, then delegate to services or plugin adapters.
- `index.ts` should remain a small process entrypoint.
- Keep CLI concerns separate from business logic. Do not move classification, Graph, or pipeline logic into command handlers.

Exit criteria:

- The CLI is a thin shell around the already-tested system.

## Acceptance Gates

Before moving to the next phase:

- Phase 1: shared types and settings compile cleanly and are imported by dependents instead of duplicated constants.
- Phase 2: sanitizer, guardrails, prompts, and warning logic have unit coverage.
- Phase 3: limits, state, triage, and dedup flows have unit coverage and deterministic behavior.
- Phase 4: Graph modules have mocked integration coverage for auth, fetch, folder ensure, move, and categorize flows.
- Phase 5: the full single-email classification path is covered by unit and integration tests.
- Phase 6: plugin tools and batch processing are exercised through integration tests.
- Phase 7: CLI commands are wired and smoke-tested without duplicating lower-layer logic.

## Test Order

Implement tests in the same order as the code:

1. `tests/unit/gtd/categories.test.ts`
2. `tests/unit/security/sanitizer.test.ts`
3. `tests/unit/security/guardrails.test.ts`
4. `tests/unit/pipeline/limits.test.ts`
5. `tests/unit/pipeline/state.test.ts`
6. `tests/unit/pipeline/triage.test.ts`
7. `tests/unit/pipeline/dedup.test.ts`
8. `tests/unit/graph/folders.test.ts`
9. `tests/unit/graph/emails.test.ts`
10. `tests/unit/gtd/classifier.test.ts`
11. `tests/integration/classify-flow.test.ts`
12. `tests/integration/organize-flow.test.ts`

Security-related modules are not done until they include adversarial malformed-input cases and multilingual fixtures.

## Defaults and Assumptions

- `docs/BACKLOG.md` remains the canonical task inventory and release checklist.
- This document is a decomposition of the implementation tasks, not a replacement backlog.
- Internal APIs should be TypeScript-first and narrow; external SDK types should be translated at boundaries.
- CLI and OpenClaw layers should stay thin and delegate to reusable services.
- The first implementation should prefer simple deterministic interfaces over early abstraction.
