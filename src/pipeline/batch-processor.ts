import type { GtdFolderName } from "../gtd/categories.js";
import type { ClassifierResult } from "../gtd/classifier.js";
import { canProcessNextEmail, createExecutionLimits, type ExecutionBudget, type ExecutionLimits } from "./limits.js";
import type { ProcessingStateStore } from "./state.js";
import { triageEmailMetadata, type EmailMetadata } from "./triage.js";

export interface ProcessInboxOptions {
  batchSize?: number;
  maxEmails?: number;
  maxLlmCalls?: number;
}

export interface ProcessInboxResult {
  processed: number;
  organized: number;
  skipped: number;
  remainingBudget: ExecutionBudget;
}

export interface BatchProcessorDependencies {
  fetchBatch: (offset: number, limit: number) => Promise<EmailMetadata[]>;
  classify: (email: EmailMetadata) => Promise<ClassifierResult>;
  organize: (email: EmailMetadata, category: GtdFolderName) => Promise<void>;
  stateStore: Pick<ProcessingStateStore, "getProcessed" | "markProcessed">;
  limits?: Partial<ExecutionLimits>;
}

export async function processInbox(
  options: ProcessInboxOptions,
  dependencies: BatchProcessorDependencies,
): Promise<ProcessInboxResult> {
  const limits = createExecutionLimits({
    ...dependencies.limits,
    batchSize: options.batchSize ?? dependencies.limits?.batchSize,
    maxEmails: options.maxEmails ?? dependencies.limits?.maxEmails,
    maxLlmCalls: options.maxLlmCalls ?? dependencies.limits?.maxLlmCalls,
  });
  const budget: ExecutionBudget = { processedEmails: 0, llmCalls: 0 };
  let offset = 0;
  let organized = 0;
  let skipped = 0;

  while (canProcessNextEmail(budget, limits)) {
    const batch = await dependencies.fetchBatch(offset, limits.batchSize);
    if (batch.length === 0) {
      break;
    }

    for (const email of batch) {
      if (!canProcessNextEmail(budget, limits)) {
        break;
      }

      const existing = dependencies.stateStore.getProcessed(email.id);
      if (existing) {
        skipped += 1;
        budget.processedEmails += 1;
        continue;
      }

      const triage = triageEmailMetadata(email);
      if (triage && triage.action !== "classify") {
        const triageCategory: GtdFolderName =
          triage.action === "reference" ? "@Reference" : triage.action === "archive" ? "Archive" : "@SomedayMaybe";
        dependencies.stateStore.markProcessed(email.id, triageCategory);
        skipped += 1;
        budget.processedEmails += 1;
        continue;
      }

      const classification = await dependencies.classify(email);
      budget.llmCalls += 1;
      await dependencies.organize(email, classification.category);
      dependencies.stateStore.markProcessed(email.id, classification.category);
      organized += 1;
      budget.processedEmails += 1;
    }

    offset += batch.length;
  }

  return {
    processed: budget.processedEmails,
    organized,
    skipped,
    remainingBudget: {
      processedEmails: Math.max(0, limits.maxEmails - budget.processedEmails),
      llmCalls: Math.max(0, limits.maxLlmCalls - budget.llmCalls),
    },
  };
}
