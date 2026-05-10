import { describe, expect, it } from "vitest";
import { buildClassificationPrompt, buildInjectionDetectionPrompt } from "../../../src/gtd/prompts";

describe("gtd/prompts", () => {
  it("builds injection detection prompt with strict JSON guidance", () => {
    const prompt = buildInjectionDetectionPrompt();
    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain("untrusted email content");
  });

  it("builds classification prompt with untrusted email boundaries", () => {
    const prompt = buildClassificationPrompt({
      subject: "Subject",
      sender: "sender@example.com",
      receivedAt: "2026-05-09T00:00:00.000Z",
      body: "Body text",
    });
    expect(prompt).toContain("<untrusted_email>");
    expect(prompt).toContain("<subject>Subject</subject>");
    expect(prompt).toContain("classify only");
  });
});
