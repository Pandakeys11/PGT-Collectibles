export const THEME_STORAGE_KEY = "pgt-ui-theme";

export const THEME_IDS = [
  "energy-nexus",
  "midnight-mirage",
  "coral-depth",
  "auric-void",
  "neon-district",
  "pastel-signal",
  "terracotta-field",
  "zen-mist",
  "obsidian-clean",
  "emerald-vault",
  "chrome-slate",
  "booster-classic",
  "illustrators-sky",
  "crystal-chamber",
  "shadow-scheme",
  "silver-dive",
  "ember-holo",
  "hoenn-dawn",
  "rainbow-chase",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME_ID: ThemeId = "obsidian-clean";

export type ThemeGroup = "core" | "tcg";

export type ThemeMeta = {
  id: ThemeId;
  label: string;
  hint: string;
  group: ThemeGroup;
};

export const THEMES: ReadonlyArray<ThemeMeta> = [
  {
    id: "energy-nexus",
    label: "Energy Nexus",
    hint: "Void base · Electric scan · Psychic AI holo",
    group: "core",
  },
  {
    id: "midnight-mirage",
    label: "Midnight Mirage",
    hint: "Psychic violet · Electric pulse edge",
    group: "core",
  },
  {
    id: "coral-depth",
    label: "Coral Depth",
    hint: "Fire heat · Water depth wash",
    group: "core",
  },
  {
    id: "auric-void",
    label: "Auric Void",
    hint: "Dragon gold vault · Metal sheen",
    group: "core",
  },
  {
    id: "neon-district",
    label: "Neon District",
    hint: "Electric neon · Psychic afterglow",
    group: "core",
  },
  {
    id: "pastel-signal",
    label: "Pastel Signal",
    hint: "Fairy blush · Water mist",
    group: "core",
  },
  {
    id: "terracotta-field",
    label: "Terracotta Field",
    hint: "Fighting earth · Fire ember",
    group: "core",
  },
  {
    id: "zen-mist",
    label: "Zen Mist",
    hint: "Grass calm · Water ripple",
    group: "core",
  },
  {
    id: "obsidian-clean",
    label: "Obsidian Clean",
    hint: "Metal slate · Electric terminal",
    group: "core",
  },
  {
    id: "emerald-vault",
    label: "Emerald Vault",
    hint: "Grass vault · Dark depth",
    group: "core",
  },
  {
    id: "chrome-slate",
    label: "Chrome Slate",
    hint: "Metal chrome · Water cool",
    group: "core",
  },
  {
    id: "booster-classic",
    label: "Booster Classic",
    hint: "Electric pack yellow · Water Poké wash",
    group: "tcg",
  },
  {
    id: "illustrators-sky",
    label: "Illustrator's Sky",
    hint: "Fairy promo sky · Dragon foil gold",
    group: "tcg",
  },
  {
    id: "crystal-chamber",
    label: "Crystal Chamber",
    hint: "Water crystal · Psychic holo edge",
    group: "tcg",
  },
  {
    id: "shadow-scheme",
    label: "Shadow Scheme",
    hint: "Dark scheme · Psychic menace",
    group: "tcg",
  },
  {
    id: "silver-dive",
    label: "Silver Dive",
    hint: "Metal silver box · Water storm",
    group: "tcg",
  },
  {
    id: "ember-holo",
    label: "Ember Holo",
    hint: "Fire chase · Dragon holo gold",
    group: "tcg",
  },
  {
    id: "hoenn-dawn",
    label: "Hoenn Dawn",
    hint: "Grass route · Fighting dawn coral",
    group: "tcg",
  },
  {
    id: "rainbow-chase",
    label: "Rainbow Chase",
    hint: "Dragon prismatic · Psychic magenta",
    group: "tcg",
  },
];

export const THEME_GROUP_LABELS: Record<ThemeGroup, string> = {
  core: "Energy Studio",
  tcg: "TCG Energy Collection",
};

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}

export function themeIndex(id: ThemeId): number {
  return THEME_IDS.indexOf(id);
}

export function nextThemeId(current: ThemeId): ThemeId {
  const i = themeIndex(current);
  const next = i < 0 ? 0 : (i + 1) % THEME_IDS.length;
  return THEME_IDS[next]!;
}
