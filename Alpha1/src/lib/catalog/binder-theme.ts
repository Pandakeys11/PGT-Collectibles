export type BinderThemeId = "white" | "black" | "red" | "blue";

export const BINDER_THEME_ORDER: BinderThemeId[] = ["white", "black", "red", "blue"];

export const BINDER_THEME_LABEL: Record<BinderThemeId, string> = {
  white: "White",
  black: "Black",
  red: "Red",
  blue: "Blue",
};

/** Swatch preview for the theme picker (cover color). */
export const BINDER_THEME_SWATCH: Record<BinderThemeId, string> = {
  white: "#f2f0ea",
  black: "#1a1a1e",
  red: "#9b2330",
  blue: "#1e4a8a",
};

export const DEFAULT_BINDER_THEME: BinderThemeId = "white";

export function binderThemeClass(theme: BinderThemeId): string {
  return `sc-binder-theme--${theme}`;
}
