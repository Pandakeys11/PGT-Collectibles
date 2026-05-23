import { buildRegistryUrl } from "@/lib/market/cert-lookup";
import type { ParsedCertRef } from "@/lib/market/cert-lookup";
import type { CertDataProvider, CertLookupResult } from "@/lib/market/cert-data-providers/types";

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  return m?.[1] ? decodeHtml(m[1]).trim() : null;
}

function parsePopulation(html: string): string | null {
  const text = stripTags(html);
  const pop =
    text.match(/Population\s*(?:in\s*)?(?:this\s*)?(?:grade\s*)?[:\s]*([\d,]+(?:\s*\/\s*[\d,]+)?)/i) ??
    text.match(/Total\s*Population[:\s]*([\d,]+)/i);
  return pop ? pop[0].replace(/\s+/g, " ").trim().slice(0, 100) : null;
}

function parseGradeDate(html: string): string | null {
  const text = stripTags(html);
  const iso = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named = text.match(
    /(?:graded|certified)\s*(?:on\s*)?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+20\d{2})/i,
  );
  return named?.[1] ?? null;
}

function parseFromTitle(title: string): { cardName: string | null; grade: string | null } {
  const t = title.replace(/\s*-\s*PSA.*$/i, "").trim();
  const gradeM = title.match(/PSA\s*(\d+(?:\.\d+)?|GEM\s*MT|AUTH)/i);
  return {
    cardName: t.length > 3 ? t.slice(0, 120) : null,
    grade: gradeM ? `PSA ${gradeM[1]}` : null,
  };
}

/**
 * Public PSA cert HTML (no API key). Fragile if PSA changes layout; fallback only.
 */
export const psaCertPageProvider: CertDataProvider = {
  id: "psa_cert_page",
  isConfigured: () => process.env.PSA_CERT_PAGE_SCRAPE !== "0",

  async lookup(ref: ParsedCertRef): Promise<CertLookupResult | null> {
    if (ref.grader.toUpperCase() !== "PSA") return null;
    const cert = ref.cert.replace(/\D/g, "");
    const url = buildRegistryUrl("PSA", cert);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "PGT-Collectibles/1.0 (+https://pgtcollectibles.com)",
          Accept: "text/html",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const html = await res.text();
      const title = metaContent(html, "og:title") ?? html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "";
      const fromTitle = parseFromTitle(decodeHtml(title));
      const body = stripTags(html);
      const cardName = fromTitle.cardName;
      const grade = fromTitle.grade ?? (body.match(/PSA\s*\d+(?:\.\d+)?/i)?.[0] ?? null);

      return {
        provider: "psa_cert_page",
        gemrateId: null,
        populationNote: parsePopulation(html),
        gradeDate: parseGradeDate(html),
        raw: { title, url },
        registry: {
          certNumber: cert,
          cardName,
          grade,
          grader: "PSA",
          registryUrl: url,
          isVerified: Boolean(cardName || grade),
        },
      };
    } catch {
      return null;
    }
  },
};
