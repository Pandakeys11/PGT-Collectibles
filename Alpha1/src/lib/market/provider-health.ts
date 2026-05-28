/** Runtime circuit breakers — keys present ≠ operational. */

let apifyEbaySoldBlockedUntil = 0;
let apifyEbaySoldBlockReason: string | null = null;

const DEFAULT_APIFY_EBAY_BLOCK_MS = 24 * 60 * 60 * 1000;

export function markApifyEbaySoldBlocked(
  reason: string,
  durationMs: number = DEFAULT_APIFY_EBAY_BLOCK_MS,
): void {
  apifyEbaySoldBlockedUntil = Date.now() + Math.max(durationMs, 60_000);
  apifyEbaySoldBlockReason = reason;
}

export function clearApifyEbaySoldBlock(): void {
  apifyEbaySoldBlockedUntil = 0;
  apifyEbaySoldBlockReason = null;
}

export function isApifyEbaySoldBlocked(): boolean {
  return Date.now() < apifyEbaySoldBlockedUntil;
}

export function getApifyEbaySoldBlockReason(): string | null {
  if (!isApifyEbaySoldBlocked()) return null;
  return apifyEbaySoldBlockReason;
}

export function parseApifyEbaySoldBlockFromBody(
  status: number,
  bodyText: string,
): string | null {
  if (status !== 403 && status !== 402 && status !== 429) return null;
  const lower = bodyText.toLowerCase();
  if (/usage hard limit|monthly.*limit|platform-feature-disabled/i.test(lower)) {
    return "Apify monthly usage limit exceeded";
  }
  if (status === 429) return "Apify rate limited";
  if (status === 403) return "Apify access denied (actor or token)";
  return null;
}
