import { describe, expect, it } from "vitest";
import { gtdWeeklyReview } from "../../../src/plugin/tools/weekly-review";

describe("plugin/weekly-review", () => {
  it("aggregates weekly review summary", () => {
    const result = gtdWeeklyReview({
      items: [
        { id: "1", category: "@Action", importance: "high" },
        { id: "2", category: "@WaitingFor" },
        { id: "3", category: "@Reference" },
      ],
    });

    expect(result.actionItems).toBe(1);
    expect(result.waitingForItems).toBe(1);
    expect(result.referenceItems).toBe(1);
    expect(result.highImportanceItems).toBe(1);
    expect(result.markdown).toContain("Weekly GTD Review");
  });
});
