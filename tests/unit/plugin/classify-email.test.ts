import { describe, expect, it } from "vitest";
import { gtdClassifyEmail } from "../../../src/plugin/tools/classify-email";

describe("plugin/classify-email", () => {
  it("sanitizes and maps category to Outlook category", async () => {
    const output = await gtdClassifyEmail(
      {
        messageId: "m1",
        subject: "Please review",
        bodyPreview: "<b>Approve by Friday</b>",
      },
      async () => ({
        category: "@Action",
        confidence: 0.9,
        reason: "Action required",
      }),
    );

    expect(output.messageId).toBe("m1");
    expect(output.outlookCategory).toBe("GTD: Action");
    expect(output.sanitizedText).toContain("Approve by Friday");
    expect(output.sanitizedText).not.toContain("<b>");
  });

  it("rejects invalid classifier output", async () => {
    await expect(
      gtdClassifyEmail(
        { messageId: "m2", subject: "FYI" },
        async () => ({ category: "invalid", confidence: 0.5, reason: "bad" }),
      ),
    ).rejects.toThrow("Classification output failed schema validation.");
  });
});
