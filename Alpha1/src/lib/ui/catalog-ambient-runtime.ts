import type { CatalogAmbientPalette } from "@/lib/ui/catalog-ambient-palette";
import { OBSIDIAN_AMBIENT } from "@/lib/ui/catalog-ambient-palette";

export const CATALOG_AMBIENT_CHANGE_EVENT = "pgt-catalog-ambient-change";

export function applyCatalogAmbientPalette(palette: CatalogAmbientPalette): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-catalog-ambient", "1");
  root.style.setProperty("--catalog-ambient-a", palette.holoA);
  root.style.setProperty("--catalog-ambient-b", palette.holoB);
  root.style.setProperty("--catalog-ambient-c", palette.holoC);
  root.style.setProperty("--catalog-ambient-mid", palette.gradientMid);
  root.style.setProperty("--catalog-ambient-bloom", palette.gradientBloom);
  root.style.setProperty("--spark-primary", palette.sparkPrimary);
  root.style.setProperty("--spark-secondary", palette.sparkSecondary);
  root.style.setProperty("--spark-tertiary", palette.sparkTertiary);
  window.dispatchEvent(new Event(CATALOG_AMBIENT_CHANGE_EVENT));
}

export function resetCatalogAmbientPalette(): void {
  applyCatalogAmbientPalette(OBSIDIAN_AMBIENT);
}
