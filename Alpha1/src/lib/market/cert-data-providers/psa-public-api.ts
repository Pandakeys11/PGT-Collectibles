import { buildRegistryUrl } from "@/lib/market/cert-lookup";
import type { ParsedCertRef } from "@/lib/market/cert-lookup";
import { parsePsaCertApiPayload } from "@/lib/market/cert-data-providers/psa-api-parse";
import {
  canUsePsaApiNow,
  tryConsumePsaApiCall,
} from "@/lib/market/cert-data-providers/psa-api-quota";
import {
  getPsaPublicApiAccessToken,
  psaPublicApiConfigured,
} from "@/lib/market/cert-data-providers/psa-api-token";
import type { CertDataProvider, CertLookupResult } from "@/lib/market/cert-data-providers/types";

/**
 * PSA Public API — official cert lookup by cert number only (free tier ≈100 calls/day).
 * Do not use for bulk catalog population — use Bright Data harvest instead.
 * Register: https://www.psacard.com/publicapi
 */
export const psaPublicCertProvider: CertDataProvider = {
  id: "psa_public",
  isConfigured: psaPublicApiConfigured,

  async lookup(ref: ParsedCertRef): Promise<CertLookupResult | null> {
    if (ref.grader.toUpperCase() !== "PSA") return null;
    if (!canUsePsaApiNow()) return null;

    const token = await getPsaPublicApiAccessToken();
    if (!token) return null;

    const cert = ref.cert.replace(/\D/g, "");
    const base =
      process.env.PSA_API_BASE_URL?.trim() || "https://api.psacard.com/publicapi";

    if (!tryConsumePsaApiCall()) return null;

    const res = await fetch(`${base}/cert/GetByCertNumber/${cert}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const parsed = parsePsaCertApiPayload(data);
    if (!parsed.isValid) return null;

    const { cardName, grade, gradeDate, population } = parsed;

    return {
      provider: "psa_public",
      gemrateId: null,
      populationNote: population.populationNote,
      gradeDate,
      raw: {
        ...data,
        _pgtSpecId: population.specId,
        _pgtGradeCounts: population.gradeCounts,
      },
      registry: {
        certNumber: cert,
        cardName,
        grade,
        grader: "PSA",
        registryUrl: buildRegistryUrl("PSA", cert),
        isVerified: true,
      },
    };
  },
};
