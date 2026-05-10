import { describe, expect, it } from "vitest";
import { classifyEmail } from "../../../src/gtd/classifier";

describe("gtd/classifier", () => {
  it("classifies actionable content as @Action", async () => {
    const result = await classifyEmail({
      id: "m1",
      subject: "Please review contract",
      sender: "maria@example.com",
      body: "Approve this by Friday.",
    });
    expect(result.category).toBe("@Action");
    expect(result.guardrailReasons).toEqual([]);
  });

  it("classifies delegated/waiting language as @WaitingFor", async () => {
    const result = await classifyEmail({
      id: "m2",
      subject: "Vendor follow up",
      sender: "team@example.com",
      body: "We are waiting for the partner response.",
    });
    expect(result.category).toBe("@WaitingFor");
  });

  it("supports mocked model classification output", async () => {
    const result = await classifyEmail(
      {
        id: "m3",
        subject: "Idea",
        sender: "team@example.com",
        body: "Maybe do this next quarter.",
      },
      {
        classify: async () => ({
          category: "@SomedayMaybe",
          confidence: 0.82,
          reason: "Deferred work.",
        }),
      },
    );
    expect(result.category).toBe("@SomedayMaybe");
  });

  it("rejects malformed model output", async () => {
    await expect(
      classifyEmail(
        {
          id: "m4",
          subject: "FYI",
          sender: "team@example.com",
          body: "reference notes",
        },
        {
          classify: async () => ({
            category: "invalid",
            confidence: 2,
            reason: "",
          }),
        },
      ),
    ).rejects.toThrow("Classifier output failed schema validation.");
  });

  it("rejects output when detector/classifier contradiction is present", async () => {
    await expect(
      classifyEmail(
        {
          id: "m5",
          subject: "urgent",
          sender: "team@example.com",
          body: "plain body",
        },
        {
          detector: {
            detect: async () => ({
              is_injection: true,
              confidence: 0.9,
              reason: "injection",
            }),
          },
          classify: async () => ({
            category: "@Action",
            confidence: 0.9,
            reason: "act now",
          }),
        },
      ),
    ).rejects.toThrow("Classification rejected by guardrails");
  });
});
