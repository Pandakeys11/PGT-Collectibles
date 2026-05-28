import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { countEbaySoldHtmlSignals, parseEbaySoldHtmlItems } from "@/lib/market/ebay-sold-html-parse";
import { isLikelyBlockedEbayHtml } from "@/lib/market/ebay-sold-common";
import {
  getBrightDataApiKey,
  getBrightDataWebUnlockerZone,
  isBrightDataUnlockerConfigured,
} from "@/lib/market/brightdata/config";
import {
  getBrightDataQuotaSnapshot,
  isBrightDataUnlockerBudgetAvailable,
  recordBrightDataUnlockerUse,
} from "@/lib/market/brightdata/quota";
import {
  brightDataBodyLooksLikeHtml,
  unwrapBrightDataResponseBody,
} from "@/lib/market/brightdata/unlocker-response";
import type { MarketEvidence } from "@/lib/scan/schemas";

const REQUEST_URL = "https://api.brightdata.com/request";
const CACHE_DIR = join(process.cwd(), ".cache", "brightdata-ebay");

function cacheTtlMs(): number {
  const hours = Number(process.env.BRIGHTDATA_EBAY_CACHE_HOURS ?? 12) || 12;
  return Math.min(Math.max(hours, 1), 72) * 60 * 60 * 1000;
}

function cachePath(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 20);
  return join(CACHE_DIR, `${hash}.html`);
}

function readCache(url: string): string | null {
  const path = cachePath(url);
  if (!existsSync(path)) return null;
  try {
    const stat = statSync(path);
    if (Date.now() - stat.mtimeMs > cacheTtlMs()) return null;
    const html = readFileSync(path, "utf8");
    return html.length > 500 ? html : null;
  } catch {
    return null;
  }
}

function writeCache(url: string, html: string): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(url), html, "utf8");
}

export function isEbaySoldBrightDataEnabled(): boolean {
  const flag = process.env.EBAY_SOLD_BRIGHTDATA?.trim().toLowerCase();
  if (flag === "0" || flag === "false") return false;
  return isBrightDataUnlockerConfigured();
}

/** Use Bright Data before Apify when Apify is down or explicitly primary. */
export function isEbaySoldBrightDataPrimary(): boolean {
  if (!isEbaySoldBrightDataEnabled()) return false;
  const flag = process.env.EBAY_SOLD_BRIGHTDATA_PRIMARY?.trim().toLowerCase();
  if (flag === "1" || flag === "true") return true;
  return false;
}

export function isEbayBrightDataSoldReady(): boolean {
  return (
    isEbaySoldBrightDataEnabled() &&
    isBrightDataUnlockerBudgetAvailable("ebay")
  );
}

function ebayUnlockerBody(url: string, zone: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    zone,
    url,
    format: "raw",
    country: process.env.BRIGHTDATA_UNLOCKER_COUNTRY?.trim() || "us",
  };
  // eBay SERP needs browser render; x-unblock-expect on .srp-results often returns 502.
  const renderOff = process.env.BRIGHTDATA_UNLOCKER_EBAY_RENDER?.trim().toLowerCase();
  if (renderOff !== "0" && renderOff !== "false") {
    body.render = true;
  }
  const expect = process.env.BRIGHTDATA_EBAY_EXPECT_SELECTOR?.trim();
  if (expect) {
    body.headers = { "x-unblock-expect": JSON.stringify({ element: expect }) };
  }
  return body;
}

/**
 * Fetch eBay completed/sold SERP HTML via Web Unlocker (quota + disk cache).
 */
export async function fetchEbaySoldHtmlViaBrightData(
  url: string,
): Promise<{ html: string; blocked: boolean; fromCache: boolean }> {
  if (!isEbaySoldBrightDataEnabled()) {
    return { html: "", blocked: true, fromCache: false };
  }

  const cached = readCache(url);
  if (cached && !isLikelyBlockedEbayHtml(cached) && countEbaySoldHtmlSignals(cached) > 2) {
    return { html: cached, blocked: false, fromCache: true };
  }

  if (!isBrightDataUnlockerBudgetAvailable("ebay")) {
    return { html: "", blocked: true, fromCache: false };
  }

  const key = getBrightDataApiKey();
  const zone = getBrightDataWebUnlockerZone();
  if (!key || !zone) return { html: "", blocked: true, fromCache: false };

  const timeoutSec = Math.min(
    Math.max(Number(process.env.BRIGHTDATA_UNLOCKER_TIMEOUT_SEC ?? 90) || 90, 20),
    180,
  );

  const res = await fetch(`${REQUEST_URL}?async=false`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/html, text/plain, */*",
    },
    body: JSON.stringify(ebayUnlockerBody(url, zone)),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutSec * 1000),
  });

  const brdStatus = res.headers.get("x-brd-status-code") ?? res.headers.get("x-luminati-error-code");
  const raw = await res.text();
  if (!res.ok || (brdStatus && brdStatus !== "200")) {
    return { html: "", blocked: true, fromCache: false };
  }

  const body = unwrapBrightDataResponseBody(raw);
  if (!body) {
    return { html: "", blocked: true, fromCache: false };
  }

  recordBrightDataUnlockerUse("ebay");
  if (!body || !brightDataBodyLooksLikeHtml(body) || isLikelyBlockedEbayHtml(body)) {
    return { html: "", blocked: true, fromCache: false };
  }

  if (countEbaySoldHtmlSignals(body) > 2) writeCache(url, body);
  return { html: body, blocked: false, fromCache: false };
}

export async function fetchEbaySoldEvidenceViaBrightData(
  url: string,
): Promise<MarketEvidence[]> {
  const { html, blocked } = await fetchEbaySoldHtmlViaBrightData(url);
  if (blocked || !html) return [];
  return parseEbaySoldHtmlItems(html);
}

export function brightDataEbayQuotaLabel(): string {
  const s = getBrightDataQuotaSnapshot();
  return `${s.remainingEbay}/${s.ebayBudget} eBay unlocks left today (${s.remainingTotal}/${s.dailyBudget} total)`;
}
