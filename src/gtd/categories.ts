export const GTD_FOLDER_NAMES = ["@Action", "@WaitingFor", "@SomedayMaybe", "@Reference", "Archive"] as const;

export type GtdFolderName = (typeof GTD_FOLDER_NAMES)[number];

export const GTD_OUTLOOK_CATEGORIES = {
  "@Action": "GTD: Action",
  "@WaitingFor": "GTD: Waiting For",
  "@SomedayMaybe": "GTD: Someday/Maybe",
  "@Reference": "GTD: Reference",
  Archive: "GTD: Archive",
} as const satisfies Record<GtdFolderName, string>;
