import { GTD_OUTLOOK_CATEGORIES } from "../../gtd/categories.js";
import { sanitizeEmailText } from "../../security/sanitizer.js";
import { isClassificationResult, type ClassificationResult } from "../../security/schemas.js";

export type ClassifyEmailInput = {
  messageId: string;
  subject?: string;
  bodyPreview?: string;
};

export type ClassifyEmailOutput = ClassificationResult & {
  messageId: string;
  outlookCategory: string;
  sanitizedText: string;
};

export type ClassificationInvoker = (sanitizedText: string, input: ClassifyEmailInput) => Promise<unknown>;

async function defaultInvoker(sanitizedText: string): Promise<ClassificationResult> {
  const lower = sanitizedText.toLowerCase();
  if (/\b(review|approve|reply|follow up|deadline|action)\b/.test(lower)) {
    return { category: "@Action", confidence: 0.72, reason: "Contains explicit action-oriented language." };
  }
  return { category: "@Reference", confidence: 0.6, reason: "No explicit action detected." };
}

export async function gtdClassifyEmail(
  input: ClassifyEmailInput,
  classify: ClassificationInvoker = defaultInvoker,
): Promise<ClassifyEmailOutput> {
  const sanitizedText = sanitizeEmailText(`${input.subject ?? ""} ${input.bodyPreview ?? ""}`).sanitized;
  const candidate = await classify(sanitizedText, input);

  if (!isClassificationResult(candidate)) {
    throw new Error("Classification output failed schema validation.");
  }

  return {
    ...candidate,
    messageId: input.messageId,
    outlookCategory: GTD_OUTLOOK_CATEGORIES[candidate.category],
    sanitizedText,
  };
}
