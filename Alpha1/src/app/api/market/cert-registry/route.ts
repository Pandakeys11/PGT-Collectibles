import { auth } from "@clerk/nextjs/server";
import { getPsaApiQuotaStatus } from "@/lib/market/cert-data-providers/psa-api-quota";
import {
  certRegistryReadySummary,
  getCertRegistryCapabilities,
} from "@/lib/market/cert-registry-capabilities";
import { certFallbackProvidersWithoutPartner } from "@/lib/market/hydrate-registry-from-card";

export const dynamic = "force-dynamic";

/** Which cert/registry providers are configured (no secrets returned). */
export async function GET() {
  await auth.protect();

  const capabilities = getCertRegistryCapabilities();
  const ready = certRegistryReadySummary();

  return Response.json({
    ok: ready.hasStructuredProvider || ready.activeChain.includes("psa_cert_page"),
    capabilities,
    activeChain: ready.activeChain,
    psaApiQuota: getPsaApiQuotaStatus(),
    fallbacksWithoutPartner: certFallbackProvidersWithoutPartner(),
    hint:
      ready.hasStructuredProvider
        ? "Graded scans can hydrate registry/population without GemRate if PSA API or Apify is configured."
        : "Add GEMRATE_API_KEY, PSA API OAuth, and/or APIFY_API_TOKEN — PSA cert page scrape is always attempted for PSA slabs.",
  });
}
