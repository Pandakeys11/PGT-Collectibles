import {
  getBrightDataApiKey,
  getBrightDataWebUnlockerZone,
  isBrightDataUnlockerConfigured,
} from "@/lib/market/brightdata/config";

const REQUEST_URL = "https://api.brightdata.com/request";

export type BrightDataPageFetch = {
  url: string;
  markdown: string | null;
  html: string | null;
};

/**
 * Sync Web Unlocker fetch — best for single cert / pop report pages.
 * Requires BRIGHTDATA_API_KEY + BRIGHTDATA_WEB_UNLOCKER_ZONE.
 */
export async function fetchPageViaBrightDataUnlocker(
  url: string,
  options?: { dataFormat?: "markdown" | "screenshot" },
): Promise<BrightDataPageFetch> {
  if (!isBrightDataUnlockerConfigured()) {
    throw new Error("brightdata_unlocker_not_configured");
  }

  const key = getBrightDataApiKey();
  const zone = getBrightDataWebUnlockerZone();
  if (!key || !zone) throw new Error("brightdata_unlocker_not_configured");

  const body: Record<string, unknown> = {
    zone,
    url,
    format: "raw",
    country: process.env.BRIGHTDATA_UNLOCKER_COUNTRY?.trim() || "us",
  };
  if (options?.dataFormat) {
    body.data_format = options.dataFormat;
  }

  const timeoutSec = Math.min(
    Math.max(Number(process.env.BRIGHTDATA_UNLOCKER_TIMEOUT_SEC ?? 90) || 90, 15),
    180,
  );

  const res = await fetch(`${REQUEST_URL}?async=false`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/html, text/plain, */*",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutSec * 1000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`brightdata_unlocker_${res.status}: ${text.slice(0, 400)}`);
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { url, markdown: null, html: null };
  }

  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed) as Record<string, unknown>;
      const inner =
        (typeof json.body === "string" && json.body) ||
        (typeof json.response === "string" && json.response) ||
        (typeof json.content === "string" && json.content) ||
        null;
      if (options?.dataFormat === "markdown" && inner) {
        return { url, markdown: inner, html: null };
      }
      if (inner) {
        const isHtml = /<html[\s>]/i.test(inner) || /<body[\s>]/i.test(inner);
        return {
          url,
          markdown: options?.dataFormat === "markdown" ? inner : null,
          html: isHtml ? inner : null,
        };
      }
    } catch {
      /* fall through */
    }
  }

  const isHtml = /<html[\s>]/i.test(trimmed) || /<body[\s>]/i.test(trimmed);
  if (options?.dataFormat === "markdown") {
    return { url, markdown: trimmed, html: null };
  }
  return { url, markdown: null, html: isHtml ? trimmed : null };
}
