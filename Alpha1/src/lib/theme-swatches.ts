import type { ThemeId } from "@/lib/themes";

/** Five-stop energy previews for the theme picker (primary → holo → void). */
export const THEME_SWATCHES: Record<ThemeId, readonly [string, string, string, string, string]> = {
  "energy-nexus": ["#ffe600", "#b517ff", "#00f5d4", "#0b0f18", "#05060a"],
  "midnight-mirage": ["#b517ff", "#f72585", "#ffe600", "#1a0f2e", "#0a0610"],
  "coral-depth": ["#ff3b1f", "#00b4d8", "#ffd166", "#2a1014", "#0e0608"],
  "auric-void": ["#ffd700", "#7b2cbf", "#c9d6df", "#3a2810", "#0c0a06"],
  "neon-district": ["#ffe600", "#b517ff", "#f72585", "#1a1808", "#0a0a05"],
  "pastel-signal": ["#ff8fab", "#90e0ef", "#ffc2d1", "#241418", "#0e080c"],
  "terracotta-field": ["#c77d3a", "#ff7a18", "#f4d35e", "#382418", "#0e0a06"],
  "zen-mist": ["#2dd36f", "#90e0ef", "#7cff6b", "#102820", "#040c08"],
  "obsidian-clean": ["#8d99ae", "#ffe600", "#edf2f4", "#1a1e28", "#080a0e"],
  "emerald-vault": ["#2dd36f", "#5b21b6", "#7cff6b", "#142820", "#060a08"],
  "chrome-slate": ["#8d99ae", "#00b4d8", "#c9d6df", "#182028", "#080a0e"],
  "booster-classic": ["#ffe600", "#00b4d8", "#48cae4", "#1a2850", "#08121c"],
  "illustrators-sky": ["#ff8fab", "#ffd700", "#00f5d4", "#243040", "#0a0e16"],
  "crystal-chamber": ["#00b4d8", "#b517ff", "#90e0ef", "#0e3040", "#040a0e"],
  "shadow-scheme": ["#5b21b6", "#f72585", "#271a3a", "#201028", "#08060c"],
  "silver-dive": ["#c9d6df", "#00b4d8", "#8d99ae", "#1a2430", "#080a0e"],
  "ember-holo": ["#ff3b1f", "#ffd700", "#ff7a18", "#401410", "#0e0606"],
  "hoenn-dawn": ["#2dd36f", "#e09f3e", "#ff7a18", "#183028", "#040c0a"],
  "rainbow-chase": ["#ff006e", "#00f5d4", "#7b2cbf", "#ffd700", "#0a0810"],
};
