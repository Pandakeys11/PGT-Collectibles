import { lookupCertViaProviders, configuredCertProviders } from "@/lib/market/cert-data-providers";
import type { CertLookupResult } from "@/lib/market/cert-data-providers/types";
import { harvestCertSpecificMarketEvidence } from "@/lib/market/cert-market-harvest";
import { hasReadableCertNumber } from "@/lib/scan/graded-slab";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import type { RegistrySnapshot } from "@/lib/scan/verification";
import {
  readCachedSlabRegistry,
  recordPgtObservation,
  upsertPgtCardIdentity,
  upsertPgtSlabRegistry,
} from "@/lib/pgt-registry/persist";

export type RegistryHydration = {
  registry: RegistrySnapshot | null;
  populationSummary: string | null;
  provider: string | null;
  gradeDate: string | null;
  gemrateId: string | null;
  certMarketEvidence: MarketEvidence[];
  fromCache: boolean;
  pgtCardIdentityId: string | null;
};

function certRefFromCard(card: ExtractedCard): { grader: string; cert: string } | null {
  if (!hasReadableCertNumber(card.cert)) return null;
  const cert = card.cert!.replace(/\D/g, "");
  const grader = (card.grader?.trim() || "PSA").toUpperCase();
  if (grader.includes("BECKETT") || grader === "BGS") return { grader: "BGS", cert };
  if (grader.includes("CGC")) return { grader: "CGC", cert };
  if (grader.includes("SGC")) return { grader: "SGC", cert };
  if (grader.includes("TAG")) return { grader: "TAG", cert };
  return { grader: "PSA", cert };
}

function populationSummaryFromHit(
  provider: string | null,
  populationNote: string | null,
  registry: RegistrySnapshot | null,
  gradeDate: string | null,
): string | null {
  if (populationNote?.trim()) {
    const dateBit = gradeDate ? ` · graded ${gradeDate}` : "";
    return `${populationNote.trim()}${dateBit}`;
  }
  if (!registry?.isVerified) return null;
  const via = provider ? `via ${provider}` : "verified";
  const name = registry.cardName ? ` — ${registry.cardName}` : "";
  const grade = registry.grade ? ` (${registry.grade})` : "";
  const dateBit = gradeDate ? ` · ${gradeDate}` : "";
  return `Registry ${via}${name}${grade}${dateBit}.`;
}

function hitFromCache(
  cached: NonNullable<Awaited<ReturnType<typeof readCachedSlabRegistry>>>,
): CertLookupResult {
  return {
    provider: (cached.provider as CertLookupResult["provider"]) ?? "psa_cert_page",
    registry: cached.registry,
    populationNote: cached.populationNote,
    gradeDate: cached.gradeDate,
    gemrateId: cached.gemrateId,
  };
}

export type HydrateRegistryOptions = {
  /** Pull cert-specific eBay/web sold rows (adds ~8–15s). */
  includeCertMarket?: boolean;
  /** Persist slab + observation (server routes only). */
  persist?: boolean;
  userId?: string | null;
  /** When known, links slab + identity to master catalog (Phase B). */
  catalogId?: string | null;
};

/**
 * Resolve grader registry + population for a graded card.
 * Chain: PGT slab cache → GemRate → PSA API → cert page → Apify → web snippets.
 */
export async function hydrateRegistryFromCard(
  card: ExtractedCard,
  options: HydrateRegistryOptions = {},
): Promise<RegistryHydration> {
  const empty: RegistryHydration = {
    registry: null,
    populationSummary: null,
    provider: null,
    gradeDate: null,
    gemrateId: null,
    certMarketEvidence: [],
    fromCache: false,
    pgtCardIdentityId: null,
  };

  const ref = certRefFromCard(card);
  if (!ref) return empty;

  let hit: CertLookupResult | null = null;
  let fromCache = false;
  let pgtCardIdentityId: string | null = null;

  const cached = await readCachedSlabRegistry(ref.grader, ref.cert);
  if (cached?.registry) {
    hit = hitFromCache(cached);
    fromCache = true;
    pgtCardIdentityId = cached.pgtCardIdentityId;
  }

  if (!hit) {
    try {
      hit = await lookupCertViaProviders(ref);
      if (hit && options.persist !== false) {
        pgtCardIdentityId = await upsertPgtCardIdentity(card, options.catalogId ?? null);
        await upsertPgtSlabRegistry({
          grader: ref.grader,
          cert: ref.cert,
          hit,
          card,
        });
      }
    } catch {
      hit = null;
    }
  }

  if (!hit) return empty;

  if (!pgtCardIdentityId) {
    pgtCardIdentityId = await upsertPgtCardIdentity(card, options.catalogId ?? null);
  }

  let certMarketEvidence: MarketEvidence[] = [];
  if (options.includeCertMarket) {
    certMarketEvidence = await harvestCertSpecificMarketEvidence(card).catch(() => []);
  }

  const populationSummary = populationSummaryFromHit(
    hit.provider,
    hit.populationNote,
    hit.registry,
    hit.gradeDate,
  );

  if (options.persist) {
    void recordPgtObservation({
      userId: options.userId ?? null,
      pgtCardIdentityId,
      eventType: "registry_hydrate",
      card,
      provider: hit.provider,
      context: {
        populationSummary,
        registryUrl: hit.registry.registryUrl,
        certProvider: hit.provider,
        certGradeDate: hit.gradeDate,
        certMarketEvidence,
        marketEvidence: certMarketEvidence,
      },
    });
  }

  return {
    registry: hit.registry,
    populationSummary,
    provider: hit.provider,
    gradeDate: hit.gradeDate,
    gemrateId: hit.gemrateId,
    certMarketEvidence,
    fromCache,
    pgtCardIdentityId,
  };
}

/** For health endpoints — which providers can run without GemRate/PSA approval. */
export function certFallbackProvidersWithoutPartner(): string[] {
  return configuredCertProviders()
    .map((p) => p.id)
    .filter((id) => id !== "gemrate" && id !== "psa_public");
}
