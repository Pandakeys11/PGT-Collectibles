import type { MarketApiAdapter, ApiAdapterResult } from "@/lib/market/adapters/types";
import { getPriceChartingApiToken } from "@/lib/market/env-market";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

function searchTerms(card: ExtractedCard): string {
  return [card.name, card.set, card.number].map((s) => s?.trim()).filter(Boolean).join(" ").slice(0, 80);
}

function pickUsd(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number.parseFloat(value.replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export const priceChartingAdapter: MarketApiAdapter = {
  id: "pricecharting",
  async collect(card: ExtractedCard): Promise<ApiAdapterResult> {
    const token = getPriceChartingApiToken();
    if (!token) return { adapter: "pricecharting", evidence: [] };

    const q = searchTerms(card) || card.name;
    const warnings: string[] = [];

    const urls = [
      `https://www.pricecharting.com/api/product?t=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`,
      `https://www.pricecharting.com/api/products?t=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`,
    ];

    for (const endpoint of urls) {
      try {
        const response = await fetch(endpoint, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        });
        if (!response.ok) continue;

        const payload = (await response.json()) as Record<string, unknown>;
        const evidence: MarketEvidence[] = [];

        const productName =
          (typeof payload["product-name"] === "string" && payload["product-name"]) ||
          (typeof payload.productName === "string" && payload.productName) ||
          (typeof payload.name === "string" && payload.name) ||
          q;

        const rawProductUrl =
          (typeof payload["product-url"] === "string" && payload["product-url"]) ||
          (typeof payload.productUrl === "string" && payload.productUrl) ||
          null;

        const loose =
          pickUsd(payload["loose-price"]) ??
          pickUsd(payload["loosePrice"]) ??
          pickUsd(payload["price-loose"]) ??
          pickUsd(payload["used-price"]);

        const cib =
          pickUsd(payload["cib-price"]) ??
          pickUsd(payload["cibPrice"]) ??
          pickUsd(payload["complete-price"]);

        const graded =
          pickUsd(payload["graded-price"]) ??
          pickUsd(payload["gradedPrice"]) ??
          pickUsd(payload["psa-10-price"]) ??
          pickUsd(payload["psa10"]);

        const productPageUrl = (() => {
          const u = rawProductUrl?.trim();
          if (!u) return `https://www.pricecharting.com/search-products?q=${encodeURIComponent(q)}&type=prices`;
          if (u.startsWith("http")) return u;
          if (u.startsWith("/")) return `https://www.pricecharting.com${u}`;
          return `https://www.pricecharting.com/search-products?q=${encodeURIComponent(q)}&type=prices`;
        })();

        const pushRef = (title: string, priceUsd: number | null, kind: MarketEvidence["kind"]) => {
          evidence.push({
            kind,
            title,
            priceUsd,
            observedAt: null,
            url: productPageUrl,
            source: "PriceCharting",
            slab: null,
          });
        };

        if (graded != null) pushRef(`${productName} (graded guide)`, graded, "reference");
        else if (cib != null) pushRef(`${productName} (complete guide)`, cib, "reference");
        else if (loose != null) pushRef(`${productName} (loose guide)`, loose, "reference");
        else if (Object.keys(payload).length > 0) {
          pushRef(String(productName), null, "reference");
        }

        if (evidence.length) return { adapter: "pricecharting", evidence, warnings };
      } catch {
        /* try next URL */
      }
    }

    warnings.push("PriceCharting API returned no usable rows for this query.");
    return { adapter: "pricecharting", evidence: [], warnings };
  },
};
