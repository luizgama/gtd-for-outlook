import type { GtdFolderName, Importance } from "./categories.js";

export interface HighImportanceWarningState {
  hasWarned: boolean;
}

export function shouldWarnForHighImportanceAction(
  category: GtdFolderName,
  importance: Importance,
  autoApprove: boolean,
  state: HighImportanceWarningState,
): boolean {
  if (autoApprove) {
    return false;
  }
  if (state.hasWarned) {
    return false;
  }
  return category === "@Action" && importance === "high";
}
