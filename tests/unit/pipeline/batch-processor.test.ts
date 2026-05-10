import { describe, expect, it } from "vitest";
import { processInbox } from "../../../src/pipeline/batch-processor";

describe("pipeline/batch-processor", () => {
  it("processes emails, skips already-processed items, and respects max-emails", async () => {
    const marked: Array<{ id: string; category: string }> = [];
    const organized: string[] = [];
    const processed = new Set<string>(["m1"]);

    const result = await processInbox(
      {
        batchSize: 2,
        maxEmails: 3,
        maxLlmCalls: 10,
      },
      {
        fetchBatch: async (offset, limit) => {
          const all = [
            { id: "m1", subject: "old", sender: "noreply@example.com", receivedAt: "2026-05-09T00:00:00.000Z" },
            { id: "m2", subject: "Please review", sender: "person@example.com", receivedAt: "2026-05-09T00:00:00.000Z" },
            { id: "m3", subject: "Weekly digest", sender: "news@example.com", receivedAt: "2026-05-09T00:00:00.000Z" },
            { id: "m4", subject: "Need action", sender: "person@example.com", receivedAt: "2026-05-09T00:00:00.000Z" },
          ];
          return all.slice(offset, offset + limit);
        },
        classify: async () => ({
          category: "@Action",
          confidence: 0.9,
          reason: "action",
          sanitizedContent: "x",
          detectionConfidence: 0.1,
          injectionDetected: false,
          guardrailReasons: [],
        }),
        organize: async (email, _category) => {
          organized.push(email.id);
        },
        stateStore: {
          getProcessed: (id: string) =>
            processed.has(id)
              ? {
                  messageId: id,
                  category: "@Action",
                  organizedAt: "2026-05-09T00:00:00.000Z",
                }
              : null,
          markProcessed: (id: string, category: string) => {
            processed.add(id);
            marked.push({ id, category });
            return { messageId: id, category, organizedAt: "2026-05-09T00:00:00.000Z" };
          },
        },
      },
    );

    expect(result.processed).toBe(3);
    expect(result.organized).toBe(1);
    expect(result.skipped).toBe(2);
    expect(organized).toEqual(["m2"]);
    expect(marked.some((entry) => entry.id === "m3")).toBe(true);
  });

  it("handles empty inbox without errors", async () => {
    const result = await processInbox(
      {
        batchSize: 10,
        maxEmails: 10,
        maxLlmCalls: 10,
      },
      {
        fetchBatch: async () => [],
        classify: async () => {
          throw new Error("should not classify");
        },
        organize: async () => {
          throw new Error("should not organize");
        },
        stateStore: {
          getProcessed: () => null,
          markProcessed: () => ({ messageId: "", category: "@Reference", organizedAt: "" }),
        },
      },
    );

    expect(result.processed).toBe(0);
    expect(result.organized).toBe(0);
    expect(result.skipped).toBe(0);
  });
});
