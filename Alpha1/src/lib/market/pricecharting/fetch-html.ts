import { isBrightDataUnlockerOperational } from "@/lib/market/brightdata/config";
import { fetchPageViaBrightDataUnlocker } from "@/lib/market/brightdata/unlocker-client";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export async function fetchPriceChartingHtml(url: string): Promise<string | null> {
  try {
    const direct = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (direct.ok) {
      const html = await direct.text();
      if (html && !/Access denied|captcha|bot detection/i.test(html)) {
        return html;
      }
    }
  } catch {
    /* Bright Data fallback */
  }

  if (!isBrightDataUnlockerOperational()) return null;
  try {
    const page = await fetchPageViaBrightDataUnlocker(url, { quotaBucket: "other" });
    if (page.html && !/Access denied|captcha|bot detection/i.test(page.html)) {
      return page.html;
    }
  } catch {
    return null;
  }
  return null;
}
