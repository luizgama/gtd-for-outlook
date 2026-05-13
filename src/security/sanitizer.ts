import { createHash } from "node:crypto";

const DEFAULT_MAX_LENGTH = 6000;

export type SanitizedEmailContent = {
  sanitizedContent: string;
  originalHash: string;
  flags: string[];
  truncated: boolean;
};

export type SanitizedContent = {
  sanitized: string;
  truncated: boolean;
};

function hashInput(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function stripBase64Payloads(input: string): string {
  return input.replace(/\b[A-Za-z0-9+/]{120,}={0,2}\b/g, " ");
}

function redactVerificationCodes(input: string): { output: string; redacted: boolean } {
  let redacted = false;
  let output = input;

  // Preserve context but mask likely OTP/security codes near verification phrases.
  output = output.replace(
    /\b(otp|one-time code|verification code|login code|security code|código de verificação|código de acesso)\b([^\n\r]{0,40}?)\b(\d{4,8})\b/gi,
    (_m, label: string, middle: string) => {
      redacted = true;
      return `${label}${middle}[REDACTED_CODE]`;
    },
  );

  // Redact standalone passcodes only when contextual cue words are present nearby.
  output = output.replace(
    /\b(code|otp|token|verification|login|security|acesso|verificação)\b([^\n\r]{0,20}?)\b(\d{6,8})\b/gi,
    (_m, label: string, middle: string) => {
      redacted = true;
      return `${label}${middle}[REDACTED_CODE]`;
    },
  );

  return { output, redacted };
}

export function sanitizeEmailContent(input: string, maxLength = DEFAULT_MAX_LENGTH): SanitizedEmailContent {
  const flags: string[] = [];
  const originalHash = hashInput(input);

  let output = input;

  const withoutScripts = output.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ");
  if (withoutScripts !== output) {
    flags.push("stripped_script");
    output = withoutScripts;
  }

  const withoutStyles = output.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ");
  if (withoutStyles !== output) {
    flags.push("stripped_style");
    output = withoutStyles;
  }

  const noHtml = output.replace(/<[^>]*>/g, " ");

  if (noHtml !== output) {
    flags.push("stripped_html_tags");
  }

  let normalized = noHtml
    .replace(/[\u200B-\u200D\uFEFF]/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized !== noHtml.trim()) {
    flags.push("normalized_unicode_or_whitespace");
  }

  const noBase64 = stripBase64Payloads(normalized);
  if (noBase64 !== normalized) {
    flags.push("stripped_base64_blob");
    normalized = noBase64.replace(/\s+/g, " ").trim();
  }

  const redactedCodes = redactVerificationCodes(normalized);
  if (redactedCodes.redacted) {
    flags.push("redacted_verification_code");
    normalized = redactedCodes.output.replace(/\s+/g, " ").trim();
  }

  let truncated = false;
  if (normalized.length > maxLength) {
    normalized = normalized.slice(0, maxLength);
    truncated = true;
    flags.push("truncated");
  }

  return {
    sanitizedContent: normalized,
    originalHash,
    flags,
    truncated,
  };
}

export function sanitizeEmailText(input: string, maxLength = DEFAULT_MAX_LENGTH): SanitizedContent {
  const sanitized = sanitizeEmailContent(input, maxLength);
  return {
    sanitized: sanitized.sanitizedContent,
    truncated: sanitized.truncated,
  };
}
