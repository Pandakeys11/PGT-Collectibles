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

export async function searchWeb(query: string, limit = 8): Promise<WebSearchResult[]> {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent": "PGT-Collectibles/1.0 (+https://pgtcollectibles.local)",
      Accept: "text/html",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!response.ok) return [];

  const html = await response.text();
  const results: WebSearchResult[] = [];
  const rowPattern =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(html)) && results.length < limit) {
    const url = decodeHtml(match[1].trim());
    const title = decodeHtml(match[2].replace(/<[^>]+>/g, "").trim());
    const snippet = decodeHtml(match[3].replace(/<[^>]+>/g, "").trim());
    if (!url || !title) continue;
    results.push({ title, url, snippet });
  }

  return results;
}
