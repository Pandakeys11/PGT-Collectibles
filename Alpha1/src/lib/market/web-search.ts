export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'");
}

const SEARCH_TIMEOUT_MS = 8_000;

function parseDuckDuckGoHtml(html: string, limit: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const patterns = [
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi,
    /<a[^>]+class="[^"]*result[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,400}?<td[^>]*class="[^"]*result-snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/gi,
  ];

  for (const rowPattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = rowPattern.exec(html)) && results.length < limit) {
      const url = decodeHtml(match[1].trim());
      const title = decodeHtml(match[2].replace(/<[^>]+>/g, "").trim());
      const snippet = decodeHtml(match[3].replace(/<[^>]+>/g, "").trim());
      if (!url || !title) continue;
      if (results.some((r) => r.url === url)) continue;
      results.push({ title, url, snippet });
    }
    if (results.length > 0) break;
  }
  return results;
}

export async function searchWeb(query: string, limit = 8): Promise<WebSearchResult[]> {
  try {
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
          "Accept-Language": "en-US,en;q=0.9",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      },
    );
    if (!response.ok) return [];
    const html = await response.text();
    return parseDuckDuckGoHtml(html, limit);
  } catch {
    return [];
  }
}
