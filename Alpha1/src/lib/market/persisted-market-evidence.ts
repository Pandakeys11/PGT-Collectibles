import { getCardFromDb } from "@/lib/catalog/db-catalog-browse";
import {
  catalogCardReferenceEvidence,
  catalogReferenceEvidence,
  parseCatalogPriceSnapshot,
} from "@/lib/market/catalog-reference-evidence";
import type { CatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
import { readCatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
import type { MarketEvidence } from "@/lib/scan/schemas";

function compKind(raw: string): MarketEvidence["kind"] {
  if (raw === "sold" || raw === "active" || raw === "reference") return raw;
  return "sold";
}

/** Turn Postgres comp rows into enrich-compatible evidence (newest first). */
export function intelCompsToMarketEvidence(intel: CatalogMarketIntel): MarketEvidence[] {
  return intel.comps.map((row) => ({
    kind: compKind(row.kind),
    title: row.title,
    priceUsd: row.priceUsd,
    observedAt: row.observedAt,
    url: row.url,
    source: row.source,
    slab: row.slab,
  }));
}

export async function loadPersistedMarketEvidence(
  catalogId: string,
  options?: { compLimit?: number },
): Promise<{
  intel: CatalogMarketIntel | null;
  evidence: MarketEvidence[];
  catalogReference: MarketEvidence[];
}> {
  const id = catalogId.trim();
  if (!id) {
    return { intel: null, evidence: [], catalogReference: [] };
  }

  const [intel, catalogCard] = await Promise.all([
    readCatalogMarketIntel(id, { compLimit: options?.compLimit ?? 48 }),
    getCardFromDb("pokemon", id),
  ]);

  const persisted = intel ? intelCompsToMarketEvidence(intel) : [];
  let catalogReference: MarketEvidence[] = [];
  if (catalogCard) {
    catalogReference = catalogCardReferenceEvidence(catalogCard);
  } else {
    const prices = parseCatalogPriceSnapshot(null);
    catalogReference = catalogReferenceEvidence(id, prices);
  }

  const seen = new Set<string>();
  const evidence: MarketEvidence[] = [];
  for (const row of [...persisted, ...catalogReference]) {
    const key = `${row.kind}|${row.url ?? ""}|${row.title}|${row.priceUsd ?? ""}|${row.observedAt ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    evidence.push(row);
  }

  return { intel, evidence, catalogReference };
}

/** True when institutional memory is strong enough to skip expensive live LLM research. */
export function hasInstitutionalMarketMemory(
  evidence: MarketEvidence[],
  options?: { minSold?: number },
): boolean {
  const minSold = options?.minSold ?? 6;
  const sold = evidence.filter((e) => e.kind === "sold" && e.priceUsd != null);
  return sold.length >= minSold;
}
