import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import injectionEN from "../../fixtures/emails/injection-attempt-en.json";
import normalEmail from "../../fixtures/emails/normal-email.json";
import { sanitizeEmailContent, sanitizeEmailText } from "../../../src/security/sanitizer";

describe("security/sanitizer", () => {
  it("strips html/scripts, removes control chars, and tracks flags", () => {
    const raw = `<script>alert("x")</script><b>Hello\u0000 world</b>`;
    const result = sanitizeEmailContent(raw);

    expect(result.sanitizedContent).toContain("Hello world");
    expect(result.sanitizedContent).not.toContain("<script>");
    expect(result.flags).toContain("stripped_script");
    expect(result.flags).toContain("stripped_html_tags");
    expect(result.flags).toContain("normalized_unicode_or_whitespace");
    expect(result.originalHash).toBe(createHash("sha256").update(raw, "utf8").digest("hex"));
  });

  it("strips long base64 payloads", () => {
    const longBlob = "A".repeat(200);
    const raw = `body ${longBlob}`;
    const result = sanitizeEmailContent(raw, 4);

    expect(result.flags).toContain("stripped_base64_blob");
  });

  it("truncates content above max length", () => {
    const result = sanitizeEmailContent("1234567890", 4);
    expect(result.flags).toContain("truncated");
    expect(result.truncated).toBe(true);
    expect(result.sanitizedContent).toBe("1234");
  });

  it("preserves normal business content from fixtures", () => {
    const input = `${normalEmail.subject} ${normalEmail.bodyPreview} ${normalEmail.body.content}`;
    const result = sanitizeEmailContent(input);
    expect(result.sanitizedContent).toContain("Project update and next steps");
    expect(result.sanitizedContent).toContain("Please review the latest draft");
  });

  it("keeps sanitizeEmailText backwards-compatible for existing callers", () => {
    const input = `${injectionEN.subject} ${injectionEN.bodyPreview}`;
    const legacy = sanitizeEmailText(input, 20);
    expect(typeof legacy.sanitized).toBe("string");
    expect(typeof legacy.truncated).toBe("boolean");
  });
});
