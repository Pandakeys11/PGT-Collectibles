import type { ScanSpecimen } from "@/hooks/use-scan-session";
import {
  displayPrintPromo,
  displayPrintVersion,
} from "@/lib/scan/display-print-edition";
import {
  canonicalPrintEditionLabel,
  printEditionBlocker,
  resolvePrintEdition,
  type PrintEditionId,
} from "@/lib/scan/print-edition";

const CATALOG_VARIANT_SUFFIX_RE =
  /__(reverse_holo|unlimited|first_edition|shadowless)$/;

const CATALOG_VARIANT_LABELS: Record<string, string> = {
  unlimited: "Unlimited",
  first_edition: "1st Edition",
  shadowless: "Shadowless",
  reverse_holo: "Reverse Holo",
};

export type PrintIdentityStatus = "confirmed" | "needs_confirm" | "custom" | "none";

export type PrintIdentitySnapshot = {
  /** Primary label for UI (1st Edition, Shadowless, custom stamps, etc.). */
  version: string;
  promo: string;
  /** Matched catalog synthetic variant when catalogId has a suffix. */
  catalogVariant: string | null;
  status: PrintIdentityStatus;
  editionId: PrintEditionId | null;
  rawStamps: string | null;
  /** Edition-related blocker from scan context (vintage FMV warning, etc.). */
  blocker: string | null;
};

export const PRINT_VERSION_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  stamps: string;
}> = [
  { id: "", label: "Not set / auto", stamps: "" },
  { id: "first_edition", label: "1st Edition", stamps: "1st Edition" },
  { id: "shadowless", label: "Shadowless", stamps: "Shadowless" },
  { id: "unlimited", label: "Unlimited", stamps: "Unlimited" },
  { id: "reverse_holo", label: "Reverse Holo", stamps: "Reverse Holo" },
  { id: "holo", label: "Holo", stamps: "Holo" },
  { id: "promo", label: "Promo", stamps: "Promo" },
];

export function catalogVariantLabelFromCatalogId(
  catalogId: string | null | undefined,
): string | null {
  const id = catalogId?.trim();
  if (!id) return null;
  const m = id.match(CATALOG_VARIANT_SUFFIX_RE);
  if (!m?.[1]) return null;
  return CATALOG_VARIANT_LABELS[m[1]] ?? m[1].replace(/_/g, " ");
}

export function printStampsForPreset(presetId: string): string {
  const hit = PRINT_VERSION_PRESETS.find((p) => p.id === presetId);
  return hit?.stamps ?? "";
}

export function matchPresetFromPrintStamps(stamps: string | undefined): string {
  const edition = resolvePrintEdition({ printStamps: stamps, details: undefined });
  if (edition && edition.id !== "unknown" && edition.id !== "promo") {
    return edition.id;
  }
  if (edition?.id === "promo") return "promo";
  return "";
}

export function printEditionBlockerFromSpecimen(specimen: ScanSpecimen): string | null {
  const fromContext = specimen.context.blockers.find((b) =>
    /1st edition|shadowless|unlimited|print run|vintage raw/i.test(b),
  );
  if (fromContext) return fromContext;
  return printEditionBlocker(specimen.card, specimen.context.lane);
}

export function buildPrintIdentitySnapshot(specimen: ScanSpecimen): PrintIdentitySnapshot {
  const { card, context } = specimen;
  const edition = resolvePrintEdition(card);
  const version = displayPrintVersion(card, context.variantLabel);
  const promo = displayPrintPromo(card, context.variantLabel);
  const catalogVariant = catalogVariantLabelFromCatalogId(context.catalogId);
  const blocker = printEditionBlockerFromSpecimen(specimen);

  let status: PrintIdentityStatus = "none";
  if (edition && edition.id !== "unknown") {
    status = "confirmed";
  } else if (version) {
    status = "custom";
  } else if (blocker) {
    status = "needs_confirm";
  }

  return {
    version,
    promo,
    catalogVariant,
    status,
    editionId: edition?.id ?? null,
    rawStamps: card.printStamps?.trim() || null,
    blocker,
  };
}

/** Human label for comps / market scope line. */
export function printIdentityMarketScopeLabel(specimen: ScanSpecimen): string | null {
  const snap = buildPrintIdentitySnapshot(specimen);
  const parts = [snap.version, snap.promo !== snap.version ? snap.promo : null, snap.catalogVariant]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  if (parts.length === 0) {
    if (snap.status === "needs_confirm") return "Print run not confirmed";
    return null;
  }
  return parts.join(" · ");
}

export function formatPrintIdentityStatusLabel(status: PrintIdentityStatus): string {
  switch (status) {
    case "confirmed":
      return "Print run identified";
    case "needs_confirm":
      return "Confirm print run";
    case "custom":
      return "Custom version note";
    default:
      return "Version not set";
  }
}

export function editionBadgeTone(
  editionId: PrintEditionId | null,
): "violet" | "amber" | "sky" | "fuchsia" | "slate" {
  switch (editionId) {
    case "first_edition":
      return "amber";
    case "shadowless":
      return "sky";
    case "unlimited":
      return "slate";
    case "reverse_holo":
    case "holo":
      return "violet";
    case "promo":
      return "fuchsia";
    default:
      return "violet";
  }
}

export function catalogVariantFromCandidateName(name: string): string | null {
  const m = name.match(/\((1st Edition|Shadowless|Unlimited|Reverse Holo)\)\s*$/i);
  return m?.[1] ?? null;
}

export function catalogVariantLabelForCard(args: {
  catalogId?: string | null;
  catalogVariantKey?: string | null;
  catalogVariantLabel?: string | null;
  printingPresetLabel?: string | null;
}): string | null {
  if (args.catalogVariantLabel?.trim()) return args.catalogVariantLabel.trim();
  if (args.catalogVariantKey?.trim()) {
    return CATALOG_VARIANT_LABELS[args.catalogVariantKey] ?? args.catalogVariantKey.replace(/_/g, " ");
  }
  const fromId = catalogVariantLabelFromCatalogId(args.catalogId);
  if (fromId) return fromId;
  if (args.printingPresetLabel?.trim()) return args.printingPresetLabel.trim();
  return null;
}

export function canonicalEditionShort(id: PrintEditionId): string {
  return canonicalPrintEditionLabel(id);
}
