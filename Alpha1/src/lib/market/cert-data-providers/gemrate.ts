import { buildRegistryUrl } from "@/lib/market/cert-lookup";
import type { ParsedCertRef } from "@/lib/market/cert-lookup";
import type { CertDataProvider, CertLookupResult } from "@/lib/market/cert-data-providers/types";

function gemrateBaseUrl(): string {
  return process.env.GEMRATE_API_BASE_URL?.trim() || "https://api.gemrate.com";
}

function gemrateKey(): string | null {
  return process.env.GEMRATE_API_KEY?.trim() || null;
}

function graderParam(grader: string): string {
  const g = grader.toUpperCase();
  if (g === "BGS") return "beckett";
  return g.toLowerCase();
}

/**
 * GemRate Partner API — preferred cross-grader cert + population source.
 * Docs: https://gemrate.stoplight.io/docs/gemrate
 * Contact: https://www.gemrate.com/partner
 */
export const gemrateCertProvider: CertDataProvider = {
  id: "gemrate",
  isConfigured: () => Boolean(gemrateKey()),

  async lookup(ref: ParsedCertRef): Promise<CertLookupResult | null> {
    const key = gemrateKey();
    if (!key) return null;

    const cert = ref.cert.replace(/\D/g, "");
    const grader = graderParam(ref.grader);
    const url = new URL(`${gemrateBaseUrl()}/v1/universal-cert-lookup`);
    url.searchParams.set("cert", cert);
    url.searchParams.set("grader", grader);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const cardName =
      (typeof data.card_name === "string" && data.card_name) ||
      (typeof data.name === "string" && data.name) ||
      (typeof data.description === "string" && data.description) ||
      null;
    const grade =
      (typeof data.grade === "string" && data.grade) ||
      (typeof data.grade_label === "string" && data.grade_label) ||
      null;
    const gemrateId =
      (typeof data.gemrate_id === "string" && data.gemrate_id) ||
      (typeof data.id === "string" && data.id) ||
      null;

    let populationNote: string | null = null;
    if (gemrateId) {
      try {
        const popRes = await fetch(`${gemrateBaseUrl()}/v1/hybrid-population-data`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ gemrate_id: gemrateId }),
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        if (popRes.ok) {
          const pop = (await popRes.json()) as Record<string, unknown>;
          const popStr = JSON.stringify(pop);
          const match = popStr.match(/"population"[^0-9]*(\d[\d,]*)/i);
          if (match) populationNote = `Population (GemRate): ${match[1]}`;
          else if (typeof pop.summary === "string") populationNote = pop.summary.slice(0, 120);
        }
      } catch {
        /* optional */
      }
    }

    const gradeDate =
      typeof data.grade_date === "string"
        ? data.grade_date
        : typeof data.graded_at === "string"
          ? data.graded_at
          : null;

    const registryUrl = buildRegistryUrl(ref.grader, cert);

    return {
      provider: "gemrate",
      gemrateId,
      populationNote,
      gradeDate,
      raw: data,
      registry: {
        certNumber: cert,
        cardName,
        grade,
        grader: ref.grader,
        registryUrl,
        isVerified: Boolean(cardName || grade),
      },
    };
  },
};
