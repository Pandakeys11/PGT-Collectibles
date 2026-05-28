/** Bright Data API — Crawl API + Web Unlocker (population / cert page harvest). */

import { isBrightDataUnlockerBudgetAvailable } from "@/lib/market/brightdata/quota";

export function getBrightDataApiKey(): string | null {
  const raw =
    process.env.BRIGHTDATA_API_KEY?.trim() ||
    process.env.BRIGHT_DATA_API_KEY?.trim() ||
    null;
  if (!raw) return null;
  if (/^(your_|replace|paste|<)/i.test(raw)) return null;
  return raw;
}

export function getBrightDataCrawlDatasetId(): string | null {
  const raw =
    process.env.BRIGHTDATA_CRAWL_DATASET_ID?.trim() ||
    process.env.BRIGHT_DATA_CRAWL_DATASET_ID?.trim() ||
    null;
  if (!raw || /^(your_|replace|paste|<)/i.test(raw)) return null;
  return raw;
}

export function getBrightDataWebUnlockerZone(): string | null {
  const raw =
    process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE?.trim() ||
    process.env.BRIGHT_DATA_WEB_UNLOCKER_ZONE?.trim() ||
    null;
  if (!raw || /^(your_|replace)/i.test(raw)) return null;
  return raw;
}

export function isBrightDataConfigured(): boolean {
  return Boolean(getBrightDataApiKey());
}

export function isBrightDataCrawlConfigured(): boolean {
  return isBrightDataConfigured() && Boolean(getBrightDataCrawlDatasetId());
}

export function isBrightDataUnlockerConfigured(): boolean {
  return isBrightDataConfigured() && Boolean(getBrightDataWebUnlockerZone());
}

/** Unlocker has remaining daily budget (free-tier guard). */
export function isBrightDataUnlockerOperational(): boolean {
  return isBrightDataUnlockerConfigured() && isBrightDataUnlockerBudgetAvailable("other");
}

export function isBrightDataPopHarvestEnabled(): boolean {
  if (process.env.BRIGHTDATA_POP_HARVEST === "0") return false;
  if (process.env.CERT_REGISTRY_BRIGHTDATA === "0") return false;
  return isBrightDataCrawlConfigured() || isBrightDataUnlockerOperational();
}

export function brightDataCrawlOutputFormat(): string {
  return (
    process.env.BRIGHTDATA_CRAWL_OUTPUT_FORMAT?.trim().toLowerCase() || "markdown"
  );
}

export function brightDataPopHarvestTimeoutMs(): number {
  const sec = Number(process.env.BRIGHTDATA_POP_HARVEST_TIMEOUT_SEC ?? 120) || 120;
  return Math.min(Math.max(sec, 30), 600) * 1000;
}

export function brightDataCrawlPollIntervalMs(): number {
  return Math.min(
    Math.max(Number(process.env.BRIGHTDATA_CRAWL_POLL_MS ?? 3000) || 3000, 1500),
    15_000,
  );
}
