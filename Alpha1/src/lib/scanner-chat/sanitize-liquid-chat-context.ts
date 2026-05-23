import type { ScanCardContext } from "@/lib/scan/schemas";

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    /* invalid */
  }
  return null;
}

/** Coerce client/session payloads so scanCardContextSchema accepts them (bad URLs are common from enrich). */
export function sanitizeScanCardContextInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const ctx = { ...(raw as Record<string, unknown>) };

  if (Array.isArray(ctx.marketEvidence)) {
    ctx.marketEvidence = ctx.marketEvidence.map((row) => {
      if (!row || typeof row !== "object") return row;
      const ev = { ...(row as Record<string, unknown>) };
      ev.url = safeHttpsUrl(ev.url);
      return ev;
    });
  }

  if (Array.isArray(ctx.marketSourceLinks)) {
    ctx.marketSourceLinks = ctx.marketSourceLinks
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const link = { ...(row as Record<string, unknown>) };
        const url = safeHttpsUrl(link.url);
        if (!url) return null;
        link.url = url;
        return link;
      })
      .filter(Boolean);
  }

  if (Array.isArray(ctx.catalogCandidates)) {
    ctx.catalogCandidates = ctx.catalogCandidates.map((row) => {
      if (!row || typeof row !== "object") return row;
      const c = { ...(row as Record<string, unknown>) };
      c.imageSmallUrl = safeHttpsUrl(c.imageSmallUrl);
      c.imageLargeUrl = safeHttpsUrl(c.imageLargeUrl);
      return c;
    });
  }

  ctx.ebaySoldSearchUrl = safeHttpsUrl(ctx.ebaySoldSearchUrl);
  ctx.ebayActiveSearchUrl = safeHttpsUrl(ctx.ebayActiveSearchUrl);
  ctx.registryUrl = safeHttpsUrl(ctx.registryUrl);
  if (ctx.catalogImageUrl !== undefined) {
    ctx.catalogImageUrl = safeHttpsUrl(ctx.catalogImageUrl);
  }

  return ctx;
}

export function sanitizeLiquidChatContexts(contexts: unknown[]): ScanCardContext[] {
  return contexts
    .map(sanitizeScanCardContextInput)
    .filter((c): c is ScanCardContext => Boolean(c && typeof c === "object"));
}
