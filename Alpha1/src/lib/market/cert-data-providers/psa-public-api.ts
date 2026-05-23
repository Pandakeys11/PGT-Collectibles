import { buildRegistryUrl } from "@/lib/market/cert-lookup";
import type { ParsedCertRef } from "@/lib/market/cert-lookup";
import {
  getPsaPublicApiAccessToken,
  psaPublicApiConfigured,
} from "@/lib/market/cert-data-providers/psa-api-token";
import type { CertDataProvider, CertLookupResult } from "@/lib/market/cert-data-providers/types";

/**
 * PSA Public API — official PSA cert data (PSA slabs only).
 * Register: https://www.psacard.com/publicapi
 */
export const psaPublicCertProvider: CertDataProvider = {
  id: "psa_public",
  isConfigured: psaPublicApiConfigured,

  async lookup(ref: ParsedCertRef): Promise<CertLookupResult | null> {
    if (ref.grader.toUpperCase() !== "PSA") return null;
    const token = await getPsaPublicApiAccessToken();
    if (!token) return null;

    const cert = ref.cert.replace(/\D/g, "");
    const base =
      process.env.PSA_API_BASE_URL?.trim() || "https://api.psacard.com/publicapi";

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
    const cardName =
      (typeof data.Subject === "string" && data.Subject) ||
      (typeof data.CardName === "string" && data.CardName) ||
      (typeof data.cardName === "string" && data.cardName) ||
      null;
    const grade =
      (typeof data.CardGrade === "string" && data.CardGrade) ||
      (typeof data.grade === "string" && data.grade) ||
      null;
    const pop =
      data.Population != null
        ? String(data.Population)
        : data.TotalPopulation != null
          ? String(data.TotalPopulation)
          : null;

    return {
      provider: "psa_public",
      gemrateId: null,
      populationNote: pop ? `PSA population: ${pop}` : null,
      gradeDate:
        typeof data.GradeDate === "string"
          ? data.GradeDate
          : typeof data.gradeDate === "string"
            ? data.gradeDate
            : null,
      raw: data,
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
