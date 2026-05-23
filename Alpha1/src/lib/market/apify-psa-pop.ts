import { getPsaPublicApiAccessToken } from "@/lib/market/cert-data-providers/psa-api-token";

const ACTOR_SLUG = "lulzasaur/psa-pop-scraper";

/** Apify Console → Settings → Integrations → Personal API tokens */
export function getApifyApiToken(): string | null {
  const raw =
    process.env.APIFY_API_TOKEN?.trim() ||
    process.env.APIFY_TOKEN?.trim() ||
    null;
  if (!raw) return null;
  if (/^(your_|replace|paste|<)/i.test(raw)) return null;
  return raw;
}

export function isApifyPsaPopConfigured(): boolean {
  if (process.env.CERT_REGISTRY_APIFY === "0") return false;
  return Boolean(getApifyApiToken());
}

function apifyDebugLog(message: string, detail?: unknown): void {
  if (process.env.APIFY_PSA_DEBUG !== "1") return;
  console.warn(`[apify-psa] ${message}`, detail ?? "");
}

function formatPsaPopNote(psaPop: Record<string, unknown> | null | undefined): string | null {
  if (!psaPop || typeof psaPop !== "object") return null;
  const total = psaPop.total;
  const g10 = psaPop.grade10;
  const g9 = psaPop.grade9;
  const parts: string[] = [];
  if (total != null) parts.push(`total ${total}`);
  if (g10 != null) parts.push(`PSA 10: ${g10}`);
  if (g9 != null) parts.push(`PSA 9: ${g9}`);
  return parts.length > 0 ? `PSA population — ${parts.join(" · ")}` : null;
}

export type ApifyPsaCertRow = {
  certNumber: string;
  cardName: string | null;
  grade: string | null;
  populationNote: string | null;
  specID: number | null;
  setName: string | null;
  raw: Record<string, unknown>;
};

/**
 * Runs Apify Actor lulzasaur/psa-pop-scraper for a single cert (sync dataset items).
 * Requires APIFY_API_TOKEN. Pass PSA bearer via env/oauth when available.
 */
export async function lookupPsaCertViaApify(certNumber: string): Promise<ApifyPsaCertRow | null> {
  const token = getApifyApiToken();
  if (!token || process.env.CERT_REGISTRY_APIFY === "0") return null;

  const cert = certNumber.replace(/\D/g, "");
  if (cert.length < 6) return null;

  const input: Record<string, unknown> = {
    certNumber: cert,
    cacheDurationHours: Number(process.env.APIFY_PSA_CACHE_HOURS ?? 168) || 168,
  };

  const psaBearer = await getPsaPublicApiAccessToken();
  if (psaBearer) input.apiToken = psaBearer;

  const actorId = ACTOR_SLUG.replace("/", "~");
  const timeoutSec = Math.min(
    Math.max(Number(process.env.APIFY_PSA_TIMEOUT_SEC ?? 120) || 120, 30),
    300,
  );
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?timeout=${timeoutSec}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout((timeoutSec + 15) * 1000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      apifyDebugLog(`HTTP ${res.status}`, errText.slice(0, 400));
      return null;
    }

    const items = (await res.json()) as unknown;
    if (!Array.isArray(items) || items.length === 0) {
      apifyDebugLog("empty dataset", items);
      return null;
    }

    const row = items[0];
    if (!row || typeof row !== "object") return null;
    const item = row as Record<string, unknown>;

    const subject =
      (typeof item.subject === "string" && item.subject) ||
      (typeof item.cardName === "string" && item.cardName) ||
      (typeof item.description === "string" && item.description) ||
      null;
    const grade =
      (typeof item.grade === "string" && item.grade) ||
      (typeof item.cardGrade === "string" && item.cardGrade) ||
      (typeof item.psaGrade === "string" && item.psaGrade) ||
      null;

    const psaPop =
      item.psaPop && typeof item.psaPop === "object"
        ? (item.psaPop as Record<string, unknown>)
        : null;

    const specID =
      typeof item.specID === "number"
        ? item.specID
        : typeof item.specId === "number"
          ? item.specId
          : null;

    return {
      certNumber: cert,
      cardName: subject?.trim().slice(0, 120) ?? null,
      grade: grade?.trim().slice(0, 40) ?? null,
      populationNote: formatPsaPopNote(psaPop),
      specID,
      setName: typeof item.setName === "string" ? item.setName : null,
      raw: item,
    };
  } catch (err) {
    apifyDebugLog(
      "request failed",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
