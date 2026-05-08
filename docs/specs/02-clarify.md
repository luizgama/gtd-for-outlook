# Spec 02: Clarify Phase

<!-- TODO: Detailed specification for the Clarify phase -->
<!-- Key responsibilities: -->
<!-- - Sanitize email body through Layer 1 (structural sanitization) -->
<!-- - Run dual-LLM injection detection (Layer 2) -->
<!-- - Call llm-task with classification prompt (Layer 3) -->
<!-- - Validate output against TypeBox schema (Layer 4) -->
<!-- - Apply post-classification guardrails (Layer 5) -->
<!-- - Content-hash deduplication via node:crypto SHA-256 before LLM calls -->
<!-- - Metadata-only fast triage for newsletters/notifications -->
