import { sanitizeEmailContent } from "../../security/sanitizer.js";

export type SanitizeInput = {
  content: string;
  maxLength?: number;
};

export function gtdSanitizeContent(input: SanitizeInput): {
  sanitizedContent: string;
  originalHash: string;
  flags: string[];
  truncated: boolean;
} {
  return sanitizeEmailContent(input.content, input.maxLength);
}
