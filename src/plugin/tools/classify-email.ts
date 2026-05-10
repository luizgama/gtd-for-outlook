import { classifyEmail, type ClassifierDependencies } from "../../gtd/classifier.js";
import { toOutlookCategory } from "../../gtd/categories.js";
import type { ClassificationResult } from "../../security/schemas.js";

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

export type ClassificationInvoker = (prompt: string, input: ClassifyEmailInput) => Promise<unknown>;

export async function gtdClassifyEmail(
  input: ClassifyEmailInput,
  classify?: ClassificationInvoker,
): Promise<ClassifyEmailOutput> {
  const dependencies: ClassifierDependencies | undefined = classify
    ? {
        classify: async (prompt) => classify(prompt, input),
      }
    : undefined;
  let candidate;
  try {
    candidate = await classifyEmail(
      {
        id: input.messageId,
        subject: input.subject ?? "",
        sender: "unknown@local",
        body: input.bodyPreview ?? "",
      },
      dependencies,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("Classifier output failed schema validation.")) {
      throw new Error("Classification output failed schema validation.");
    }
    throw error;
  }

  return {
    category: candidate.category,
    confidence: candidate.confidence,
    reason: candidate.reason,
    messageId: input.messageId,
    outlookCategory: toOutlookCategory(candidate.category),
    sanitizedText: candidate.sanitizedContent,
  };
}
