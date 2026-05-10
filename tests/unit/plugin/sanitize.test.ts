import { describe, expect, it } from "vitest";
import { gtdSanitizeContent } from "../../../src/plugin/tools/sanitize";

describe("plugin/sanitize", () => {
  it("sanitizes content and returns metadata", () => {
    const result = gtdSanitizeContent({
      content: "<script>x</script><b>Hello</b>",
    });
    expect(result.sanitizedContent).toContain("Hello");
    expect(result.flags).toContain("stripped_script");
    expect(result.originalHash.length).toBe(64);
  });
});
