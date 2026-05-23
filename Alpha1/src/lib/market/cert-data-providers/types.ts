import type { RegistrySnapshot } from "@/lib/scan/verification";
import type { ParsedCertRef } from "@/lib/market/cert-lookup";

export type CertDataProviderId =
  | "gemrate"
  | "psa_public"
  | "apify_psa"
  | "psa_cert_page"
  | "web_snippet";

export type CertLookupResult = {
  provider: CertDataProviderId;
  registry: RegistrySnapshot;
  populationNote: string | null;
  gradeDate: string | null;
  gemrateId: string | null;
  raw?: Record<string, unknown>;
};

export type CertDataProvider = {
  id: CertDataProviderId;
  isConfigured: () => boolean;
  lookup: (ref: ParsedCertRef) => Promise<CertLookupResult | null>;
};
