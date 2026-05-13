# NEXT PHASE PLAN: Improve GTD Email Classification Quality

## Context Snapshot (2026-05-13)
OpenClaw feedback shows low-quality classifier behavior:
- 10/10 messages classified as `Archive`
- confidence always `0.56`
- reason always `No clear action signal detected.`

This matches current fallback behavior in `src/gtd/classifier.ts`, where the default path returns exactly that output when regex checks miss.

## Phase Goal
Increase classification precision for non-actionable-but-useful records by routing them to `@Reference`, improve confidence calibration, and add sanitizer redaction for sensitive codes.

## Success Criteria
1. Mixed dataset no longer collapses into uniform `Archive` + `0.56`.
2. Confirmations/approvals/receipts/system notices/meeting reports map to `@Reference` unless explicit user action is assigned.
3. OTP/verification messages map to `Archive` by policy, with secrets redacted in sanitized content.
4. Tests cover Portuguese + English approval status differences (`aguarda aprovação` vs `aprovado`).
5. Confidence values vary by evidence strength and classification path.

---

## Step 1: Strengthen Prompt Policy for GTD Boundary Decisions

### Changes
- Update `buildClassificationPrompt` in `src/gtd/prompts.ts` with explicit policy rules:
  - Use `@Reference` for useful records that do not require immediate user action.
  - Use `@Reference` for confirmations/approvals/receipts/completed admin decisions.
  - Use `@Reference` for incident/maintenance notices unless explicit action is required.
  - Use `@Reference` for meeting summaries unless user-specific next action is explicit.
  - Use `Archive` for low-value/expired/marketing/noise/OTP-like messages not needed as record.
  - Prefer `@Action` for pending approval or explicit follow-up required by the user.
- Add output rubric language to improve confidence calibration guidance (high/medium/low evidence).

### Code Review Checkpoint
- Confirm prompt remains injection-safe (no instruction-following from email body).
- Ensure prompt wording is deterministic and category definitions do not overlap ambiguously.

---

## Step 2: Replace Blunt Fallback Heuristics with Evidence-Based Rules

### Changes
- Refactor `fallbackClassification` in `src/gtd/classifier.ts`:
  - Add weighted evidence rules for:
    - `@Reference`: approvals, receipts, reports, incident/maintenance, FYI/admin confirmations.
    - `@Action`: explicit assigned tasks, deadlines, pending approval (`pending`, `aguarda aprovação`, `awaiting your approval`).
    - `Archive`: promotional/newsletter/spam patterns, OTP/verification code notices.
  - Resolve conflicts with precedence rules (e.g., explicit assigned action > reference cues).
  - Keep `@WaitingFor` and `@SomedayMaybe` signals but rebalance to avoid overfiring.
- Return richer reason strings referencing strongest evidence signal.

### Code Review Checkpoint
- Verify no single weak token can force category incorrectly.
- Verify bilingual cues (PT/EN) are represented and normalized with case-insensitive matching.

---

## Step 3: Confidence Calibration Model

### Changes
- Introduce confidence bands in fallback path based on evidence quality:
  - strong direct signal: `0.80–0.92`
  - moderate contextual signal: `0.68–0.79`
  - weak ambiguous signal: `0.55–0.67`
- Prevent uniform confidence values by deriving confidence from matched rule strength + tie/ambiguity penalties.
- Ensure guardrails still enforce `[0,1]` and schema compatibility.

### Code Review Checkpoint
- Validate confidence monotonicity (stronger evidence cannot yield lower confidence than weaker evidence in same class).
- Validate deterministic outputs for identical inputs.

---

## Step 4: Redact OTP/Verification Secrets in Sanitizer

### Changes
- Extend `sanitizeEmailContent` in `src/security/sanitizer.ts` to redact likely one-time codes and token-like secrets before classification output exposure.
- Add sanitizer flags (e.g., `redacted_verification_code`) when redaction triggers.
- Preserve enough context words for classification (e.g., "verification code" remains, digits redacted).

### Code Review Checkpoint
- Ensure redaction is targeted (avoid redacting normal dates/amounts indiscriminately).
- Confirm sanitized text still supports category inference (`Archive` for OTP).

---

## Step 5: Expand Test Coverage with Feedback-Derived Fixtures

### Changes
- Add/extend tests in:
  - `tests/unit/gtd/classifier.test.ts`
  - `tests/unit/gtd/prompts.test.ts`
  - `tests/unit/security/sanitizer.test.ts`
- Add concrete test fixtures representing the feedback set:
  - AI meeting report -> `@Reference`
  - incident/maintenance notice -> `@Reference`
  - "Férias aprovadas" -> `@Reference`
  - "Aprovado" invoice/hours -> `@Reference`
  - newsletter -> `Archive`
  - verification code -> `Archive` + code redacted flag
  - Skyscanner marketing report -> `@Reference` or `Archive` by explicit rule (define and test)
  - "aguarda aprovação" / "awaiting approval" -> `@Action`
- Add a regression test asserting a mixed 10-email batch does not produce all identical category+confidence pairs.

### Code Review Checkpoint
- Confirm tests fail against old behavior and pass with new behavior.
- Confirm reasons are specific (not all "No clear action signal detected.").

---

## Step 6: Optional Duplicate-Notice Preference Hook

### Changes
- Define a configurable preference for duplicate vendor/system notices in pipeline triage:
  - default: keep first as `@Reference`, later duplicates `Archive` or low-priority `@Reference`.
- Implement only if low-risk within phase scope; otherwise track as immediate next backlog item.

### Code Review Checkpoint
- Ensure preference is off-by-default or backward-compatible.
- Ensure dedup logic does not drop unique incident updates.

---

## Verification Commands (Implementation Phase)

```bash
npm test -- tests/unit/gtd/classifier.test.ts tests/unit/gtd/prompts.test.ts tests/unit/security/sanitizer.test.ts
npm test -- tests/unit/pipeline/dedup.test.ts tests/unit/pipeline/triage.test.ts
```

If available, run a local OpenClaw smoke classification with representative sample emails and compare category distribution before/after.

---

## New Clear Context For Next Implementation Phase

### Phase Name
`Classification Quality Upgrade (Reference-First Non-Actionable Records)`

### In Scope
- Prompt policy updates
- Fallback classifier rule redesign
- Confidence calibration
- OTP/code redaction
- Unit/regression tests for the above

### Out of Scope
- Large-scale model/provider changes
- End-to-end scheduler behavior changes
- Inbox move/organize mechanics (already addressed)

### Implementation Order
1. Prompt policy
2. Fallback rules
3. Confidence calibration
4. Sanitizer redaction
5. Tests + regression gate
6. Optional duplicate-notice preference

### Exit Gate
Phase completes when mixed fixtures produce non-uniform outputs and align with the revised Archive vs `@Reference` policy.
