import { generateWeeklyReview, type WeeklyReviewItem, type WeeklyReviewSummary } from "../../gtd/review.js";

export type WeeklyReviewInput = {
  items: WeeklyReviewItem[];
};

export function gtdWeeklyReview(input: WeeklyReviewInput): WeeklyReviewSummary {
  return generateWeeklyReview(input.items);
}
