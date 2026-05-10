import { describe, expect, it } from "vitest";
import { GTD_FOLDER_NAMES, GTD_OUTLOOK_CATEGORIES, isGtdCategory, toOutlookCategory } from "../../../src/gtd/categories";

describe("gtd/categories", () => {
  it("defines all expected GTD categories", () => {
    expect(GTD_FOLDER_NAMES).toEqual(["@Action", "@WaitingFor", "@SomedayMaybe", "@Reference", "Archive"]);
  });

  it("maps each GTD category to an Outlook category", () => {
    expect(toOutlookCategory("@Action")).toBe("GTD: Action");
    expect(toOutlookCategory("@WaitingFor")).toBe("GTD: Waiting For");
    expect(GTD_OUTLOOK_CATEGORIES.Archive).toBe("GTD: Archive");
  });

  it("validates category membership", () => {
    expect(isGtdCategory("@Reference")).toBe(true);
    expect(isGtdCategory("random")).toBe(false);
  });
});
