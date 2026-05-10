import { describe, expect, it } from "vitest";
import { shouldWarnForHighImportanceAction } from "../../../src/gtd/warnings";

describe("gtd/warnings", () => {
  it("warns for first high-importance action item", () => {
    expect(
      shouldWarnForHighImportanceAction("@Action", "high", false, {
        hasWarned: false,
      }),
    ).toBe(true);
  });

  it("skips warning when auto-approve is enabled", () => {
    expect(
      shouldWarnForHighImportanceAction("@Action", "high", true, {
        hasWarned: false,
      }),
    ).toBe(false);
  });

  it("skips warning after warning was already shown", () => {
    expect(
      shouldWarnForHighImportanceAction("@Action", "high", false, {
        hasWarned: true,
      }),
    ).toBe(false);
  });
});
