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
  /** Primary Pokémon energy identity for this preset */
  energy: string;
};

export const THEMES: ReadonlyArray<ThemeMeta> = [
  {
    id: "energy-nexus",
    label: "Energy Nexus",
    hint: "Void base · Electric scan · Psychic AI holo",
    group: "core",
    energy: "Electric + Psychic",
  },
  {
    id: "midnight-mirage",
    label: "Midnight Mirage",
    hint: "Psychic violet · Electric pulse edge",
    group: "core",
    energy: "Psychic + Electric",
  },
  {
    id: "coral-depth",
    label: "Coral Depth",
    hint: "Fire heat · Water depth wash",
    group: "core",
    energy: "Fire + Water",
  },
  {
    id: "auric-void",
    label: "Auric Void",
    hint: "Dragon gold vault · Metal sheen",
    group: "core",
    energy: "Dragon + Metal",
  },
  {
    id: "neon-district",
    label: "Neon District",
    hint: "Electric neon · Psychic afterglow",
    group: "core",
    energy: "Electric + Psychic",
  },
  {
    id: "pastel-signal",
    label: "Pastel Signal",
    hint: "Fairy blush · Water mist",
    group: "core",
    energy: "Fairy + Water",
  },
  {
    id: "terracotta-field",
    label: "Terracotta Field",
    hint: "Fighting earth · Fire ember",
    group: "core",
    energy: "Fighting + Fire",
  },
  {
    id: "zen-mist",
    label: "Zen Mist",
    hint: "Grass calm · Water ripple",
    group: "core",
    energy: "Grass + Water",
  },
  {
    id: "obsidian-clean",
    label: "Obsidian Clean",
    hint: "Metal slate · Electric terminal",
    group: "core",
    energy: "Metal + Electric",
  },
  {
    id: "emerald-vault",
    label: "Emerald Vault",
    hint: "Grass vault · Dark depth",
    group: "core",
    energy: "Grass + Dark",
  },
  {
    id: "chrome-slate",
    label: "Chrome Slate",
    hint: "Metal chrome · Water cool",
    group: "core",
    energy: "Metal + Water",
  },
  {
    id: "booster-classic",
    label: "Booster Classic",
    hint: "Electric pack yellow · Water Poké wash",
    group: "tcg",
    energy: "Electric + Water",
  },
  {
    id: "illustrators-sky",
    label: "Illustrator's Sky",
    hint: "Fairy promo sky · Dragon foil gold",
    group: "tcg",
    energy: "Fairy + Dragon",
  },
  {
    id: "crystal-chamber",
    label: "Crystal Chamber",
    hint: "Water crystal · Psychic holo edge",
    group: "tcg",
    energy: "Water + Psychic",
  },
  {
    id: "shadow-scheme",
    label: "Shadow Scheme",
    hint: "Dark scheme · Psychic menace",
    group: "tcg",
    energy: "Dark + Psychic",
  },
  {
    id: "silver-dive",
    label: "Silver Dive",
    hint: "Metal silver box · Water storm",
    group: "tcg",
    energy: "Metal + Water",
  },
  {
    id: "ember-holo",
    label: "Ember Holo",
    hint: "Fire chase · Dragon holo gold",
    group: "tcg",
    energy: "Fire + Dragon",
  },
  {
    id: "hoenn-dawn",
    label: "Hoenn Dawn",
    hint: "Grass route · Fighting dawn coral",
    group: "tcg",
    energy: "Grass + Fighting",
  },
  {
    id: "rainbow-chase",
    label: "Rainbow Chase",
    hint: "Dragon prismatic · Psychic magenta",
    group: "tcg",
    energy: "Dragon + Psychic",
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
