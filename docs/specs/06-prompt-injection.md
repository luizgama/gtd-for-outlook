# Spec 06: Prompt Injection Defense

<!-- TODO: Detailed specification for the multi-layer defense strategy -->
<!-- -->
<!-- Layer 1: Structural Sanitization (security/sanitizer.ts) -->
<!--   - Strip Unicode control characters, zero-width chars -->
<!--   - Remove homoglyph substitutions -->
<!--   - Truncate to safe maximum length -->
<!--   - Strip HTML/script tags, base64-encoded payloads -->
<!-- -->
<!-- Layer 2: Dual-LLM Injection Detection (security/detector.ts) -->
<!--   - Separate sandboxed llm-task call for injection detection -->
<!--   - Language-agnostic (LLM understands multiple languages) -->
<!--   - JSON-only response: { is_injection, confidence, reason } -->
<!-- -->
<!-- Layer 3: Sandboxed Classification via llm-task -->
<!--   - JSON-only output, no tools exposed -->
<!--   - Email content as input data, separated from prompt -->
<!-- -->
<!-- Layer 4: Schema Validation (security/schemas.ts) -->
<!--   - TypeBox strict output schemas -->
<!--   - Only accept predefined GTD categories -->
<!--   - Reject echoed email content or unexpected fields -->
<!-- -->
<!-- Layer 5: Post-Classification Guardrails (security/guardrails.ts) -->
<!--   - Enum check on categories -->
<!--   - Anomaly detection (batch identical classifications) -->
<!--   - Cross-check detector vs classifier results -->
<!-- -->
<!-- Layer 6: Structural Prompt Design (gtd/prompts.ts) -->
<!--   - XML-delimited boundaries for untrusted content -->
<!--   - Explicit warning prefix -->
<!--   - Few-shot multilingual injection examples -->
<!--   - Sandwich defense (repeat instruction after content) -->
