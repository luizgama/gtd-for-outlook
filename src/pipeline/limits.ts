export interface ExecutionLimits {
  batchSize: number;
  maxEmails: number;
  maxLlmCalls: number;
}

export interface ExecutionBudget {
  processedEmails: number;
  llmCalls: number;
}

export const DEFAULT_EXECUTION_LIMITS: ExecutionLimits = {
  batchSize: 50,
  maxEmails: 200,
  maxLlmCalls: 500,
};

export function createExecutionLimits(overrides: Partial<ExecutionLimits> = {}): ExecutionLimits {
  return {
    batchSize: Math.max(1, overrides.batchSize ?? DEFAULT_EXECUTION_LIMITS.batchSize),
    maxEmails: Math.max(1, overrides.maxEmails ?? DEFAULT_EXECUTION_LIMITS.maxEmails),
    maxLlmCalls: Math.max(1, overrides.maxLlmCalls ?? DEFAULT_EXECUTION_LIMITS.maxLlmCalls),
  };
}

export function canProcessNextEmail(budget: ExecutionBudget, limits: ExecutionLimits): boolean {
  return budget.processedEmails < limits.maxEmails && budget.llmCalls < limits.maxLlmCalls;
}
