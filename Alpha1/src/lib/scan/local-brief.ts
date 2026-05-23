import type { ScanCardContext, StructuredBrief } from "@/lib/scan/schemas";
import { analyzeMarketEvidence, gradeBucketLabel } from "@/lib/market/market-intelligence";

function formatUsd(value: number | null): string {
  if (value == null) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

function statusLabel(status: ScanCardContext["verificationStatus"]): string {
  if (status === "verified") return "registry-aligned";
  if (status === "failed") return "needs reconciliation (mismatch)";
  return "needs human confirmation";
}

function topSoldEvidenceLines(context: ScanCardContext, max: number): string[] {
  const sold = context.marketEvidence
    .filter((e) => e.kind === "sold" && e.priceUsd != null && Number.isFinite(e.priceUsd))
    .slice(0, max);
  if (sold.length === 0) return [];
  return sold.map((e) => {
    const src = e.source?.trim() || "source";
    const date = e.observedAt ? new Date(e.observedAt).toLocaleDateString() : "date n/a";
    const title = e.title.length > 90 ? `${e.title.slice(0, 87)}…` : e.title;
    return `• ${formatUsd(e.priceUsd)} · ${date} · ${src} — ${title}`;
  });
}

function basisLabel(basis: ScanCardContext["fairValueBasis"]): string {
  if (!basis) return "";
  const map: Record<string, string> = {
    sold_median: "median of sold comps in-session",
    active_median: "median of active asks in-session",
    reference_median: "median of guide/reference rows",
    sticker_anchor: "anchored to visible sticker / tag",
    tcg_catalog: "TCGPlayer market (catalog API)",
  };
  return map[basis] ?? basis.replace(/_/g, " ");
}

function editionScopeFromExtraction(
  extraction: ScanCardContext["extraction"],
): { printStamps?: string; details?: string } {
  return {
    printStamps: typeof extraction.printStamps === "string" ? extraction.printStamps : undefined,
    details: typeof extraction.details === "string" ? extraction.details : undefined,
  };
}

export function buildLocalStructuredBrief(context: ScanCardContext): StructuredBrief {
  const marketIntel = analyzeMarketEvidence(context.marketEvidence, {
    card: editionScopeFromExtraction(context.extraction),
    stickerUsd: context.askingUsd,
    targetGradeBucket: context.lane === "graded" ? undefined : "raw",
  });
  const verification =
    context.verificationFields.length > 0
      ? context.verificationFields
      : [
          { field: "name", extracted: context.name, verified: null, status: "unverified" as const },
          { field: "set", extracted: context.setName, verified: null, status: "unverified" as const },
          { field: "number", extracted: context.cardNumber, verified: null, status: "unverified" as const },
          { field: "variant", extracted: context.variantLabel, verified: null, status: "unverified" as const },
        ];

  const confidencePct = Math.round(context.confidence * 100);
  const lane = context.lane;

  const summaryParts = [
    `**${context.name}** · ${lane} lane · ${statusLabel(context.verificationStatus)}.`,
    [context.setName, context.cardNumber].filter(Boolean).length
      ? `Identity: **${[context.setName, context.cardNumber].filter(Boolean).join(" · ")}**.`
      : "Fill **set** and **number** from the crop before trusting comps.",
    `Confidence **${confidencePct}%**${context.blockers.length ? ` · ${context.blockers[0]}` : ""}.`,
  ];

  const summary = summaryParts.join(" ");

  const valuationParts = [
    `**Sticker / ask:** ${formatUsd(context.askingUsd)} · **FMV:** ${formatUsd(context.fairValueUsd)}${context.fairValueBasis ? ` (${basisLabel(context.fairValueBasis)})` : ""} · **Target grade:** ${gradeBucketLabel(marketIntel.targetBucket)} (${marketIntel.confidenceLabel} confidence).`,
    lane === "graded"
      ? "Graded: cert + grade drive price — cross-check auction prints (Goldin, eBay sold) with index tools (Card Ladder, ALT) when relevant."
      : "Raw: use **TCGPlayer / Cardmarket** for catalog depth, **eBay sold** for what actually clears, **PriceCharting** when the print maps cleanly.",
    topSoldEvidenceLines(context, 3).length
      ? `**Samples:**\n${topSoldEvidenceLines(context, 3).join("\n")}`
      : "No priced samples in-session yet — use the **Sold** / **Listed** links.",
  ];

  const valuation = valuationParts.join("\n\n");

  const soldCount = context.marketEvidence.filter((e) => e.kind === "sold").length;
  const activeCount = context.marketEvidence.filter((e) => e.kind === "active").length;
  const refCount = context.marketEvidence.filter((e) => e.kind === "reference").length;

  const marketSnapshot = [
    `Session comps: **${soldCount} sold** · **${activeCount} active** · **${refCount} reference** · **${marketIntel.auctionCount} auction-like** (enriched as of ${new Date(context.marketAsOf).toLocaleDateString()}).`,
    context.fairValueUsd != null
      ? `Model FMV **${formatUsd(context.fairValueUsd)}**${context.fairValueBasis ? ` (${basisLabel(context.fairValueBasis)})` : ""}${context.askingUsd != null ? ` vs sticker/ask **${formatUsd(context.askingUsd)}**` : ""}.`
      : "FMV not computed — confirm identity, then refresh market enrich.",
  ].join(" ");

  const compLines = topSoldEvidenceLines(context, 5);
  const bucketLines = marketIntel.buckets
    .filter((bucket) => bucket.soldCount > 0 || bucket.activeCount > 0 || bucket.bucket === marketIntel.targetBucket)
    .slice(0, 5)
    .map(
      (bucket) =>
        `• ${bucket.label}: ${formatUsd(bucket.medianSoldUsd ?? bucket.medianActiveUsd)} · ${bucket.soldCount} sold · ${bucket.activeCount} listed`,
    );
  const compAnalysis =
    compLines.length > 0
      ? [...bucketLines, ...compLines].join("\n")
      : "No priced sold rows in-session. Use hub **Sold** links and re-run market enrich after set/number are confirmed.";

  const nextChecksRaw = [
    context.blockers[0] ?? null,
    context.verificationStatus !== "verified"
      ? "Confirm **name, set, and number** against the crop."
      : null,
    context.askingUsd == null ? "Capture **sticker or ask** if still visible on the holder." : null,
    lane === "graded"
      ? "Graded: verify **cert** in registry, then compare **same grade** sales across hubs."
      : "Raw: triage **TCGPlayer + Cardmarket** → **eBay sold** for realized prints → **PriceCharting** for guide rails.",
    context.registryUrl && lane === "graded" ? "Open **registry** to lock population context." : null,
  ].filter((item): item is string => Boolean(item));
  const nextChecks = Array.from(new Set(nextChecksRaw));

  return {
    summary,
    marketSnapshot,
    compAnalysis,
    verification,
    gradedSupply: context.populationSummary,
    marketEvidence: context.marketEvidence.slice(0, 8),
    valuation,
    nextChecks,
  };
}
