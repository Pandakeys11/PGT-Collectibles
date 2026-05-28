export const THEME_STORAGE_KEY = "pgt-ui-theme";

/** Single default desk theme — custom palettes removed in favor of catalog ambient. */
export const THEME_IDS = ["obsidian-clean"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME_ID: ThemeId = "obsidian-clean";

export type ThemeGroup = "core";

export type ThemeMeta = {
  id: ThemeId;
  label: string;
  hint: string;
  group: ThemeGroup;
};

export const THEMES: ReadonlyArray<ThemeMeta> = [
  {
    id: "obsidian-clean",
    label: "Obsidian Clean",
    hint: "Metal slate · catalog ambient wash",
    group: "core",
  },
];

export const THEME_GROUP_LABELS: Record<ThemeGroup, string> = {
  core: "Default",
};

export function isThemeId(value: string): value is ThemeId {
  return value === DEFAULT_THEME_ID;
}

export function themeIndex(id: ThemeId): number {
  return id === DEFAULT_THEME_ID ? 0 : -1;
}

export function nextThemeId(current: ThemeId): ThemeId {
  void current;
  return DEFAULT_THEME_ID;
}
