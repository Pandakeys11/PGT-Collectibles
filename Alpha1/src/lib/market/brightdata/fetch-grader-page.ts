import {
  crawlUrlsAndDownload,
  extractCrawlRowContent,
} from "@/lib/market/brightdata/crawl-client";
import {
  isBrightDataCrawlConfigured,
  isBrightDataUnlockerOperational,
} from "@/lib/market/brightdata/config";
import { fetchPageViaBrightDataUnlocker } from "@/lib/market/brightdata/unlocker-client";

export type GraderPageContent = {
  url: string;
  content: string;
  via: "crawl" | "unlocker";
};

/**
 * Fetch one grader URL — prefers Crawl API when dataset is configured,
 * otherwise Web Unlocker markdown.
 */
export async function fetchGraderPageContent(url: string): Promise<GraderPageContent | null> {
  if (isBrightDataUnlockerOperational()) {
    try {
      const page = await fetchPageViaBrightDataUnlocker(url, {
        dataFormat: "markdown",
        quotaBucket: "cert",
      });
      const content = page.markdown ?? page.html ?? "";
      if (content.trim().length > 80) {
        return { url, content, via: "unlocker" };
      }
    } catch {
      /* try crawl */
    }
  }

  if (isBrightDataCrawlConfigured()) {
    try {
      const rows = await crawlUrlsAndDownload([url]);
      const parts = rows
        .map((row) => extractCrawlRowContent(row))
        .filter((c) => c.trim().length > 0);
      const content = parts.join("\n\n");
      if (content.trim().length > 80) {
        return { url, content, via: "crawl" };
      }
    } catch {
      return null;
    }
  }

  return null;
}
