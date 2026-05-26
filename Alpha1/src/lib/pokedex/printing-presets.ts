/**
 * Shared print-run tab ids for vintage catalog + marketplace bias.
 */

export type PrintingPresetId = "catalog" | "unlimited" | "first_edition" | "shadowless";

export type PrintingPresetOption = { id: PrintingPresetId; label: string; hint?: string };

const PRESET_LABELS: Record<PrintingPresetId, string> = {
  catalog: "Catalog",
  unlimited: "Unlimited",
  first_edition: "1st Edition",
  shadowless: "Shadowless",
};

export function printingPresetLabel(preset: PrintingPresetId): string {
  return PRESET_LABELS[preset] ?? preset;
}
