import type { GtdFolderName } from "./categories.js";

export interface WeeklyReviewItem {
  id: string;
  category: GtdFolderName;
  importance?: "high" | "normal" | "low";
}

export interface WeeklyReviewSummary {
  actionItems: number;
  waitingForItems: number;
  somedayItems: number;
  referenceItems: number;
  highImportanceItems: number;
  markdown: string;
}

export function generateWeeklyReview(items: WeeklyReviewItem[]): WeeklyReviewSummary {
  const summary: WeeklyReviewSummary = {
    actionItems: 0,
    waitingForItems: 0,
    somedayItems: 0,
    referenceItems: 0,
    highImportanceItems: 0,
    markdown: "",
  };

  for (const item of items) {
    if (item.category === "@Action") {
      summary.actionItems += 1;
    } else if (item.category === "@WaitingFor") {
      summary.waitingForItems += 1;
    } else if (item.category === "@SomedayMaybe") {
      summary.somedayItems += 1;
    } else if (item.category === "@Reference") {
      summary.referenceItems += 1;
    }

    if (item.importance === "high") {
      summary.highImportanceItems += 1;
    }
  }

  summary.markdown = [
    "# Weekly GTD Review",
    "",
    `- @Action: ${summary.actionItems}`,
    `- @WaitingFor: ${summary.waitingForItems}`,
    `- @SomedayMaybe: ${summary.somedayItems}`,
    `- @Reference: ${summary.referenceItems}`,
    `- High importance: ${summary.highImportanceItems}`,
  ].join("\n");

  return summary;
}
// - Aggregate classification data from the past week
// - Generate summary: action items pending, delegated, completed
// - Output as formatted CLI report or markdown
