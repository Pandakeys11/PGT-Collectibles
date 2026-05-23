import { isApifyPsaPopConfigured } from "@/lib/market/apify-psa-pop";
import { psaPublicApiConfigured } from "@/lib/market/cert-data-providers/psa-api-token";
import { getGeminiApiKey } from "@/lib/ai/env";

export type CertRegistryCapability = {
  id: string;
  label: string;
  configured: boolean;
  tier: "partner" | "official" | "paid_fallback" | "free";
  notes: string;
};

export function getCertRegistryCapabilities(): CertRegistryCapability[] {
  const gemrate = Boolean(process.env.GEMRATE_API_KEY?.trim());
  const psaApi = psaPublicApiConfigured();
  const psaManualToken = Boolean(process.env.PSA_API_ACCESS_TOKEN?.trim());
  const apify = isApifyPsaPopConfigured();
  const psaPage = process.env.PSA_CERT_PAGE_SCRAPE !== "0";
  const gemini = Boolean(getGeminiApiKey());

  return [
    {
      id: "gemrate",
      label: "GemRate Partner API",
      configured: gemrate,
      tier: "partner",
      notes: "Preferred — PSA/BGS/CGC/SGC cert + population (requires partner approval).",
    },
    {
      id: "psa_public",
      label: "PSA Public API",
      configured: psaApi || psaManualToken,
      tier: "official",
      notes: "OAuth at psacard.com/publicapi or PSA_API_ACCESS_TOKEN bearer.",
    },
    {
      id: "apify_psa",
      label: "Apify PSA Pop Scraper",
      configured: apify,
      tier: "paid_fallback",
      notes: "APIFY_API_TOKEN — ~$5/1k results; set CERT_REGISTRY_APIFY=0 to disable.",
    },
    {
      id: "psa_cert_page",
      label: "PSA cert page fetch",
      configured: psaPage,
      tier: "free",
      notes: "Direct HTML parse; fragile if PSA changes layout.",
    },
    {
      id: "web_snippet",
      label: "DuckDuckGo cert snippets",
      configured: true,
      tier: "free",
      notes: "Always available as last resort.",
    },
    {
      id: "gemini_ask",
      label: "Gemini search (Liquid Ask)",
      configured: gemini,
      tier: "free",
      notes: "Google Search grounding on market questions — not per-cert enrich.",
    },
  ];
}

export function certRegistryReadySummary(): {
  hasStructuredProvider: boolean;
  activeChain: string[];
} {
  const caps = getCertRegistryCapabilities();
  const active = caps.filter((c) => c.configured).map((c) => c.id);
  const hasStructuredProvider = active.some((id) =>
    ["gemrate", "psa_public", "apify_psa"].includes(id),
  );
  return { hasStructuredProvider, activeChain: active };
}
