import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { fetchMessagesPage } from "../../src/graph/emails";
import { GraphClient } from "../../src/graph/client";

const ClassificationSchema = Type.Object(
  {
    category: Type.Union([
      Type.Literal("@Action"),
      Type.Literal("@WaitingFor"),
      Type.Literal("@SomedayMaybe"),
      Type.Literal("@Reference"),
    ]),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    reason: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("integration/classify-flow", () => {
  it("runs fetch -> sanitize -> classify -> schema validate with mocked boundaries", async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          value: [
            {
              id: "m1",
              subject: "Please review contract",
              bodyPreview: "<b>Need approval</b> by Friday",
            },
          ],
        }),
        { status: 200 },
      );

    const client = new GraphClient({
      tokenProvider: async () => "token",
      fetchImpl: mockFetch as typeof fetch,
    });

    const page = await fetchMessagesPage(client, { top: 1, select: ["id", "subject", "bodyPreview"] });
    const email = page.messages[0];

    const sanitized = sanitizeText(`${email.subject ?? ""} ${email.bodyPreview ?? ""}`);
    expect(sanitized).toContain("Please review contract");
    expect(sanitized).toContain("Need approval by Friday");

    // Mocked llm-task output contract for integration flow validation.
    const classification = {
      category: "@Action",
      confidence: 0.93,
      reason: "Direct request requiring follow-up.",
    };

    expect(Value.Check(ClassificationSchema, classification)).toBe(true);
  });
});
