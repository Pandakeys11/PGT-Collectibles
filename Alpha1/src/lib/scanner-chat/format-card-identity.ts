import type { CardMatch } from "@/lib/scanner-chat/types";
import { catalogVariantLabelFromCatalogId } from "@/lib/scan/print-identity-ui";
import { printEditionBlocker } from "@/lib/scan/print-edition";
import { displayPrintVersion, displayPrintPromo } from "@/lib/scan/display-print-edition";

export type CardIdentityFields = {
  name: string;
  setName: string;
  collectorId: string;
  year: string;
  version: string;
  promo: string;
  catalogId: string | null;
  needsVersionConfirm: boolean;
  metaLine: string;
};

function clean(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return v && v !== "—" ? v : "";
}

export function formatCollectorId(value: string | null | undefined): string {
  const v = clean(value);
  if (!v) return "—";
  return v.startsWith("#") ? v : `#${v}`;
}

/** Uniform set · # · year line for list + carousel + panels. */
export function formatCardMetaLine(args: {
  setName?: string | null;
  setNumber?: string | null;
  year?: string | null;
}): string {
  const parts = [
    clean(args.setName),
    formatCollectorId(args.setNumber),
    clean(args.year),
  ].filter((p) => p && p !== "—");
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function buildCardIdentityFields(card: CardMatch): CardIdentityFields {
  const catalogVariant = catalogVariantLabelFromCatalogId(card.catalogId);
  const variantFallback = catalogVariant ?? null;

  let version =
    clean(card.printVersion) ||
    (card.extractedCard
      ? displayPrintVersion(card.extractedCard, variantFallback)
      : "") ||
    catalogVariant ||
    "";

  const promo =
    clean(card.printPromo) ||
    (card.extractedCard ? displayPrintPromo(card.extractedCard, variantFallback) : "") ||
    "";

  const needsVersionConfirm =
    !version &&
    Boolean(
      card.extractedCard &&
        printEditionBlocker(card.extractedCard, card.graded ? "graded" : "raw"),
    );

  if (needsVersionConfirm) {
    version = "Confirm print run";
  }

  const setName = clean(card.setName) || "—";
  const collectorId = formatCollectorId(card.setNumber);
  const year = clean(card.year) || "—";

  return {
    name: clean(card.name) || "Unknown card",
    setName,
    collectorId,
    year,
    version,
    promo: promo && promo !== version ? promo : "",
    catalogId: clean(card.catalogId ?? null) || null,
    needsVersionConfirm,
    metaLine: formatCardMetaLine({
      setName: card.setName,
      setNumber: card.setNumber,
      year: card.year,
    }),
  };
}
