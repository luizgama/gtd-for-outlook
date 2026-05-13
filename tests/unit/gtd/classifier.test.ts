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

  it("classifies approved confirmations as @Reference", async () => {
    const result = await classifyEmail({
      id: "m6",
      subject: "Férias aprovadas",
      sender: "rh@example.com",
      body: "Seu pedido foi aprovado e registrado no sistema.",
    });
    expect(result.category).toBe("@Reference");
    expect(result.reason.toLowerCase()).toContain("record");
  });

  it("classifies pending approval language as @Action", async () => {
    const result = await classifyEmail({
      id: "m7",
      subject: "Aguarda aprovação",
      sender: "finance@example.com",
      body: "Esta solicitação aguarda aprovação do responsável.",
    });
    expect(result.category).toBe("@Action");
  });

  it("classifies system incident notices as @Reference when no action is required", async () => {
    const result = await classifyEmail({
      id: "m8",
      subject: "Zscaler maintenance notice",
      sender: "ops@example.com",
      body: "FYI: planned maintenance window and incident summary. No action required.",
    });
    expect(result.category).toBe("@Reference");
  });

  it("classifies newsletter as Archive", async () => {
    const result = await classifyEmail({
      id: "m9",
      subject: "Weekly newsletter",
      sender: "news@example.com",
      body: "Promotion and discount offers. Unsubscribe anytime.",
    });
    expect(result.category).toBe("Archive");
  });

  it("classifies verification code notices as Archive and redacts secret", async () => {
    const result = await classifyEmail({
      id: "m10",
      subject: "Verification code",
      sender: "security@example.com",
      body: "Your verification code is 112233 and expires in 10 minutes.",
    });
    expect(result.category).toBe("Archive");
    expect(result.sanitizedContent).toContain("[REDACTED_CODE]");
    expect(result.sanitizedContent).not.toContain("112233");
  });

  it("does not collapse mixed messages to identical category/confidence", async () => {
    const samples = [
      {
        id: "b1",
        subject: "AI meeting report",
        body: "Meeting report and notes about procurement context.",
      },
      {
        id: "b2",
        subject: "Maintenance notice",
        body: "Incident summary and maintenance update for reference.",
      },
      {
        id: "b3",
        subject: "Aprovado!",
        body: "Invoice and hours were approved.",
      },
      {
        id: "b4",
        subject: "Newsletter",
        body: "Marketing promotion and offers.",
      },
      {
        id: "b5",
        subject: "Verification code",
        body: "OTP 998877 for login.",
      },
    ];

    const results = await Promise.all(
      samples.map((s) =>
        classifyEmail({
          id: s.id,
          subject: s.subject,
          sender: "noreply@example.com",
          body: s.body,
        }),
      ),
    );

    const uniqueCategoryConfidencePairs = new Set(results.map((r) => `${r.category}:${r.confidence.toFixed(2)}`));
    expect(uniqueCategoryConfidencePairs.size).toBeGreaterThan(1);
  });
});
