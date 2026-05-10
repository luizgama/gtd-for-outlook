# Execution Map

This document is the implementation-order companion to `docs/BACKLOG.md`.

- `docs/BACKLOG.md` tracks what remains to be done.
- `docs/EXECUTION_MAP.md` defines how to execute the implementation, in what order, and with which first concrete interfaces.

The goal is to let an implementing engineer or agent work through the scaffolded codebase without making sequencing or interface decisions ad hoc.

## Current Status After Phase E

The source tree has moved beyond scaffold status. Security, GTD logic, pipeline primitives, and plugin integration checkpoint work are now implemented with passing tests on `main`. The immediate gap is no longer core logic; it is runtime usability surface (config loading, CLI command shell, and scheduler ergonomics).

Known current state:

- Graph modules and plugin fetch/classify/organize wrappers have passing coverage.
- `src/pipeline/state.ts` has a working state store and passing coverage.
- `src/plugin/index.ts` now uses `definePluginEntry()` style registration, which resolved the D3 missing-tool symptom.
- `src/plugin/index.js` is a runtime bridge to `dist/plugin/index.js` and must fail with an actionable `npm run build` message when the dist entry is missing.
- D4 showed that local validation cannot assume systemd is available; cron/gateway checks need sandbox-friendly CLI and health-command paths.
- Step 2-4 placeholder modules/tests have been replaced and are covered.
- `src/config/constants.ts`, `src/config/settings.ts`, `src/cli.ts`, and `src/index.ts` remain the primary delivery-surface critical path.

## Dependency Order

Implementation should now proceed in this revised order:

1. Stabilized foundations and schemas
2. Pure security logic
3. GTD category, warning, prompt, and classifier logic
4. Pipeline limits, triage, dedup, and batch orchestration
5. Plugin integration against the completed core
6. CLI, scheduling, and review flow
7. Final hardening and release

This order is intentional:

- Refresh internal types, schemas, constants, and config before implementing logic that depends on them.
- Implement deterministic local logic before external integrations.
- Keep OpenClaw plugin wiring and CLI wiring thin by building them on top of already-tested services.
- Treat Graph as an already-available boundary for this phase; do not rework it unless the new core interfaces require a narrow adapter change.

## Phase 1: Stabilized Foundations

Objective: lock the core data model, configuration shape, and schema contracts used everywhere else.

Files:

- `src/config/constants.ts`
- `src/gtd/categories.ts`
- `src/security/schemas.ts`
- `src/config/settings.ts`

Prerequisites:

- Existing Graph and plugin contracts should continue to compile.

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

- `constants.ts` currently remains a TODO and should define default numeric limits, default folder names, and default local storage locations.
- `categories.ts` already exposes folder/category names; expand it only as needed for classifier and warnings tests.
- `schemas.ts` has a minimal classification schema; extend it before classifier/guardrail implementation so validation is shared.
- `settings.ts` remains a TODO; implement it before CLI and batch processing need runtime config.

Exit criteria:

- Every later module can import shared types and defaults from one place.
- The schema layer is stable enough for tests and tool contracts.

## Phase 2: Pure Security Logic

Objective: replace TODO-only security modules and empty security tests with deterministic behavior that does not require Graph or OpenClaw.

Files:

- `src/security/sanitizer.ts`
- `src/security/detector.ts`
- `src/security/guardrails.ts`
- `src/security/schemas.ts`
- `tests/unit/security/sanitizer.test.ts`
- `tests/unit/security/detector.test.ts`
- `tests/unit/security/guardrails.test.ts`

Prerequisites:

- Phase 1 schemas.
- Real fixture content in `tests/fixtures/emails/*.json` for normal and injection cases.

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
```

Implementation notes:

- `sanitizer.ts` should perform the structural cleaning described in `docs/plan.md`, not semantic threat detection.
- Preserve the existing simple sanitizer behavior only if it is covered and compatible with the richer `SanitizedEmailContent` contract.
- `detector.ts` should define the adapter boundary for injection detection. Unit tests should mock the model call and verify multilingual prompt-injection handling.
- `guardrails.ts` should reject invalid categories, invalid confidence ranges, obvious echoed-content failures, and detector/classifier contradictions.

Exit criteria:

- The security-critical pure logic is testable without any external service.
- Classification inputs and outputs are stable enough for orchestration.
- Empty security test files have been replaced with real suites.

## Phase 3: GTD Logic

Objective: implement category helpers, prompts, warnings, and the single-email classifier on top of the security layer.

Files:

- `src/gtd/categories.ts`
- `src/gtd/prompts.ts`
- `src/gtd/warnings.ts`
- `src/gtd/classifier.ts`
- `tests/unit/gtd/categories.test.ts`
- `tests/unit/gtd/warnings.test.ts`
- `tests/unit/gtd/classifier.test.ts`

Prerequisites:

- Phase 1 categories/schemas.
- Phase 2 sanitizer, detector boundary, and guardrails.

First concrete interfaces:

```ts
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

- `prompts.ts` should return stable prompt builders with XML boundaries and untrusted-content framing.
- `warnings.ts` should contain only warning decision logic; user interaction belongs later in CLI/plugin layers.
- `classifier.ts` should orchestrate sanitization, detection, classification prompt construction, schema validation, and guardrails. Keep OpenClaw-specific invocation details outside the classifier.
- Add dedup and metadata triage once Phase 4 primitives exist; do not block the first classifier unit tests on those modules.

Exit criteria:

- A single email can be classified through the protected local flow using mocked model/detector dependencies.
- Empty GTD test files have been replaced with real suites.

## Phase 4: Pipeline Primitives and Batch Shell

Objective: implement local state, run controls, fast triage, and dedup primitives before wiring external APIs.

Files:

- `src/pipeline/limits.ts`
- `src/pipeline/state.ts`
- `src/pipeline/triage.ts`
- `src/pipeline/dedup.ts`
- `src/pipeline/batch-processor.ts`
- `tests/unit/pipeline/limits.test.ts`
- `tests/unit/pipeline/state.test.ts`
- `tests/unit/pipeline/triage.test.ts`
- `tests/unit/pipeline/dedup.test.ts`
- `tests/unit/pipeline/batch-processor.test.ts`

Prerequisites:

- Phase 2 security interfaces.
- Phase 3 classifier interface.
- Existing `ProcessingStateStore` behavior should remain backward-compatible with plugin organize tests.

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
- `state.ts` already provides message-level processed state; extend deliberately for checkpoint/resume needs rather than replacing the API used by `gtd_organize_email`.
- `triage.ts` should apply only clear metadata rules described in `docs/plan.md`.
- `dedup.ts` should hide hashing and `sql.js` cache-storage details behind a small API so classifier code stays simple. Prefer SHA-256 unless the dependency set is intentionally changed.
- `batch-processor.ts` should coordinate bounded resumable runs after limits, triage, dedup, and classifier contracts are real.

Exit criteria:

- The project can decide whether an email should be skipped, classified, or resumed without touching Graph or OpenClaw.
- Empty pipeline test files have been replaced with real suites.

## Phase 5: Plugin Integration Checkpoint

Objective: wire the completed core logic into existing plugin tools without regressing D3/D4 runtime behavior.

Files:

- `src/plugin/tools/classify-email.ts`
- `src/plugin/tools/graph-fetch.ts`
- `src/plugin/tools/graph-organize.ts`
- `src/plugin/tools/weekly-review.ts`
- `src/plugin/tools/sanitize.ts`
- `src/plugin/index.ts`
- `src/plugin/index.js`

Prerequisites:

- Phases 1 through 4.

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

- Plugin tool files should be thin wrappers that validate parameters and delegate to services.
- `plugin/index.ts` should only register tools and bind them to already-implemented services. Preserve the `definePluginEntry()` shaped default export learned from D3.
- `plugin/index.js` should remain a thin built-dist bridge with a clear build instruction on failure.
- `sanitize.ts` should expose Layer 1 as a standalone inspection tool, not duplicate sanitizer logic.
- Do not rely on systemd for local D4 validation; use OpenClaw CLI health/status paths that work in the sandbox.

Exit criteria:

- OpenClaw can call stable tool handlers backed by tested internal services.
- A clean checkout that has not run `npm run build` fails with a clear plugin runtime message rather than silent missing tools.

## Phase 6: CLI, Scheduling, and Review Flow

Objective: finish the user-facing interface after the lower layers are stable.

Files:

- `src/gtd/review.ts`
- `src/cli.ts`
- `src/index.ts`

Prerequisites:

- Phases 1 through 5.

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
- Scheduling commands must account for environments without systemd. The CLI should surface actionable errors or use OpenClaw's sandbox-compatible cron interfaces.

Exit criteria:

- The CLI is a thin shell around the already-tested system.

## Acceptance Gates

Before moving to the next phase:

- Phase 1: shared types and settings compile cleanly and are imported by dependents instead of duplicated constants.
- Phase 2: sanitizer, detector, schemas, and guardrails have unit coverage with adversarial malformed-input and multilingual fixtures.
- Phase 3: categories, prompts, warnings, and classifier logic have unit coverage and mocked model boundaries.
- Phase 4: limits, state, triage, dedup, and batch processing have unit coverage and deterministic behavior.
- Phase 5: plugin tools are backed by the completed core, `npm run build` passes, and D3 missing-tool behavior does not regress.
- Phase 6: CLI commands and scheduling paths are wired and smoke-tested without duplicating lower-layer logic or assuming systemd.

## Test Order

Implement tests in the same order as the code:

1. `tests/unit/security/sanitizer.test.ts`
2. `tests/unit/security/detector.test.ts`
3. `tests/unit/security/guardrails.test.ts`
4. `tests/unit/gtd/categories.test.ts`
5. `tests/unit/gtd/warnings.test.ts`
6. `tests/unit/gtd/classifier.test.ts`
7. `tests/unit/pipeline/limits.test.ts`
8. `tests/unit/pipeline/triage.test.ts`
9. `tests/unit/pipeline/dedup.test.ts`
10. `tests/unit/pipeline/batch-processor.test.ts`
11. Existing Graph and plugin tests as regression coverage.
12. `tests/integration/classify-flow.test.ts`
13. `tests/integration/organize-flow.test.ts`

Security-related modules are not done until they include adversarial malformed-input cases and multilingual fixtures.

## Defaults and Assumptions

- `docs/BACKLOG.md` remains the canonical task inventory and release checklist.
- This document is a decomposition of the implementation tasks, not a replacement backlog.
- Internal APIs should be TypeScript-first and narrow; external SDK types should be translated at boundaries.
- CLI and OpenClaw layers should stay thin and delegate to reusable services.
- The first implementation should prefer simple deterministic interfaces over early abstraction.
- `NEXT_PHASE_PLAN.md` is an intentionally temporary handoff file and may be force-added despite `.gitignore` when explicitly requested.
