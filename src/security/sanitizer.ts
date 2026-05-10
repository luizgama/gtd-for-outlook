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
