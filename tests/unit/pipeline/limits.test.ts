import { describe, expect, it } from "vitest";
import { canProcessNextEmail, createExecutionLimits, DEFAULT_EXECUTION_LIMITS } from "../../../src/pipeline/limits";

describe("pipeline/limits", () => {
  it("uses defaults when no overrides are provided", () => {
    expect(createExecutionLimits()).toEqual(DEFAULT_EXECUTION_LIMITS);
  });

  it("normalizes invalid values to minimum 1", () => {
    const limits = createExecutionLimits({
      batchSize: 0,
      maxEmails: -2,
      maxLlmCalls: 0,
    });
    expect(limits.batchSize).toBe(1);
    expect(limits.maxEmails).toBe(1);
    expect(limits.maxLlmCalls).toBe(1);
  });

  it("stops when max emails is reached", () => {
    expect(
      canProcessNextEmail(
        { processedEmails: 200, llmCalls: 10 },
        { batchSize: 50, maxEmails: 200, maxLlmCalls: 500 },
      ),
    ).toBe(false);
  });

  it("stops when max llm calls is reached", () => {
    expect(
      canProcessNextEmail(
        { processedEmails: 20, llmCalls: 500 },
        { batchSize: 50, maxEmails: 200, maxLlmCalls: 500 },
      ),
    ).toBe(false);
  });
});
