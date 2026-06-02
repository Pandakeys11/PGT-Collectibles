/** Same-origin proxy for catalog card art — long browser cache, instant revisits. */

export function isCatalogImageProxyEnabled(): boolean {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_CATALOG_IMAGE_PROXY === "0") {
    return false;
  }
  return true;
}

export function catalogImageSrc(url: string | undefined | null): string | undefined {
  if (!url?.trim()) return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) return trimmed;
  if (trimmed.startsWith("/api/img?")) return trimmed;
  if (!isCatalogImageProxyEnabled()) return trimmed;
  return `/api/img?url=${encodeURIComponent(trimmed)}`;
}
