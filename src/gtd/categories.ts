export const GTD_FOLDER_NAMES = ["@Action", "@WaitingFor", "@SomedayMaybe", "@Reference", "Archive"] as const;

export type GtdFolderName = (typeof GTD_FOLDER_NAMES)[number];
export type Importance = "high" | "normal" | "low";

export const GTD_OUTLOOK_CATEGORIES = {
  "@Action": "GTD: Action",
  "@WaitingFor": "GTD: Waiting For",
  "@SomedayMaybe": "GTD: Someday/Maybe",
  "@Reference": "GTD: Reference",
  Archive: "GTD: Archive",
} as const satisfies Record<GtdFolderName, string>;

const GTD_FOLDERS_SET = new Set<string>(GTD_FOLDER_NAMES);

export function isGtdCategory(value: string): value is GtdFolderName {
  return GTD_FOLDERS_SET.has(value);
}

export function toOutlookCategory(category: GtdFolderName): string {
  return GTD_OUTLOOK_CATEGORIES[category];
}
