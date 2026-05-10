import { describe, expect, it } from "vitest";
import injectionEN from "../../fixtures/emails/injection-attempt-en.json";
import injectionES from "../../fixtures/emails/injection-attempt-es.json";
import injectionMulti from "../../fixtures/emails/injection-attempt-multilingual.json";
import injectionPT from "../../fixtures/emails/injection-attempt-pt.json";
import normalEmail from "../../fixtures/emails/normal-email.json";
import { buildInjectionDetectionPrompt, createInjectionDetector } from "../../../src/security/detector";

describe("security/detector", () => {
  it("detects english injection attempt with heuristic detector", async () => {
    const detector = createInjectionDetector();
    const result = await detector.detect({
      subject: injectionEN.subject,
      body: injectionEN.body.content,
    });
    expect(result.is_injection).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("detects portuguese, spanish, and multilingual injections through shared patterns", async () => {
    const detector = createInjectionDetector();
    const samples = [injectionPT, injectionES, injectionMulti];
    for (const sample of samples) {
      const result = await detector.detect({
        subject: sample.subject,
        body: sample.body.content,
      });
      expect(result.is_injection).toBe(true);
    }
  });

  it("passes legitimate email and returns non-injection result", async () => {
    const detector = createInjectionDetector();
    const result = await detector.detect({
      subject: normalEmail.subject,
      body: normalEmail.body.content,
    });
    expect(result.is_injection).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("validates invoker output schema and rejects malformed detector responses", async () => {
    const detector = createInjectionDetector(async () => ({ bad: true }));
    await expect(
      detector.detect({
        subject: "x",
        body: "y",
      }),
    ).rejects.toThrow("Injection detection output failed schema validation.");
  });

  it("builds prompt with untrusted email boundaries", () => {
    const prompt = buildInjectionDetectionPrompt({
      subject: "Subject",
      sender: "sender@example.com",
      body: "Body text",
    });
    expect(prompt).toContain("<email>");
    expect(prompt).toContain("<subject>Subject</subject>");
    expect(prompt).toContain("<body>Body text</body>");
  });
});
