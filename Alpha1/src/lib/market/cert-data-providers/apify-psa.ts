import { lookupPsaCertViaApify, isApifyPsaPopConfigured } from "@/lib/market/apify-psa-pop";
import { buildRegistryUrl } from "@/lib/market/cert-lookup";
import type { ParsedCertRef } from "@/lib/market/cert-lookup";
import type { CertDataProvider, CertLookupResult } from "@/lib/market/cert-data-providers/types";

/**
 * Apify PSA Pop Scraper — fallback when GemRate / PSA Public API are unavailable.
 * Paid (~$5/1k results); uses optional PSA bearer to avoid shared 100/day pool.
 */
export const apifyPsaCertProvider: CertDataProvider = {
  id: "apify_psa",
  isConfigured: isApifyPsaPopConfigured,

  async lookup(ref: ParsedCertRef): Promise<CertLookupResult | null> {
    if (ref.grader.toUpperCase() !== "PSA") return null;
    const hit = await lookupPsaCertViaApify(ref.cert);
    if (!hit) return null;

    const verified = Boolean(hit.cardName || hit.grade || hit.populationNote);
    return {
      provider: "apify_psa",
      gemrateId: hit.specID != null ? String(hit.specID) : null,
      populationNote: hit.populationNote,
      gradeDate: null,
      raw: hit.raw,
      registry: {
        certNumber: hit.certNumber,
        cardName: hit.cardName,
        grade: hit.grade,
        grader: "PSA",
        registryUrl: buildRegistryUrl("PSA", hit.certNumber),
        isVerified: verified,
      },
    };
  },
};
