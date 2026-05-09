const DEFAULT_MAX_LENGTH = 6000;

export type SanitizedContent = {
  sanitized: string;
  truncated: boolean;
};

export function sanitizeEmailText(input: string, maxLength = DEFAULT_MAX_LENGTH): SanitizedContent {
  const noHtml = input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ");

  const normalized = noHtml
    .replace(/[\u200B-\u200D\uFEFF]/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) {
    return { sanitized: normalized, truncated: false };
  }

  return { sanitized: normalized.slice(0, maxLength), truncated: true };
}
