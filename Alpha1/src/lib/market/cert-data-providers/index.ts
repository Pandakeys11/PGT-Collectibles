import { lookupCertViaWeb } from "@/lib/market/cert-lookup";
import type { ParsedCertRef } from "@/lib/market/cert-lookup";
import { apifyPsaCertProvider } from "@/lib/market/cert-data-providers/apify-psa";
import { gemrateCertProvider } from "@/lib/market/cert-data-providers/gemrate";
import { psaCertPageProvider } from "@/lib/market/cert-data-providers/psa-cert-page";
import { psaPublicCertProvider } from "@/lib/market/cert-data-providers/psa-public-api";
import type { CertDataProvider, CertLookupResult } from "@/lib/market/cert-data-providers/types";

/** Apify last before web — sync actor can take up to ~90s; cert page is faster for enrich. */
const ORDERED_PROVIDERS: CertDataProvider[] = [
  gemrateCertProvider,
  psaPublicCertProvider,
  psaCertPageProvider,
  apifyPsaCertProvider,
];

function isUsefulCertHit(hit: CertLookupResult | null): hit is CertLookupResult {
  if (!hit) return false;
  return (
    hit.registry.isVerified ||
    Boolean(hit.registry.cardName?.trim()) ||
    Boolean(hit.populationNote?.trim())
  );
}

export function configuredCertProviders(): CertDataProvider[] {
  return ORDERED_PROVIDERS.filter((p) => p.isConfigured());
}

/**
 * Best-available cert lookup:
 * GemRate → PSA Public API → PSA cert page HTML → Apify PSA Pop → DuckDuckGo snippets.
 */
export async function lookupCertViaProviders(
  ref: ParsedCertRef,
): Promise<CertLookupResult | null> {
  for (const provider of ORDERED_PROVIDERS) {
    if (!provider.isConfigured()) continue;
    try {
      const hit = await provider.lookup(ref);
      if (isUsefulCertHit(hit)) return hit;
    } catch {
      /* try next */
    }
  }

  const web = await lookupCertViaWeb(ref);
  return {
    provider: "web_snippet",
    gemrateId: null,
    populationNote: web.populationNote,
    gradeDate: web.gradeDate,
    registry: web.registry,
  };
}

export type { CertLookupResult, CertDataProviderId } from "@/lib/market/cert-data-providers/types";
