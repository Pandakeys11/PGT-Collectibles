/**
 * Shared print-run tab ids for vintage catalog + marketplace bias.
 */

export type PrintingPresetId = "catalog" | "unlimited" | "first_edition" | "shadowless";

export type PrintingPresetOption = { id: PrintingPresetId; label: string; hint?: string };
