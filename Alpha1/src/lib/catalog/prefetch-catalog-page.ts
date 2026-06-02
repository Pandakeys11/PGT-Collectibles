import { fetchCatalogJson, readCatalogCache } from "@/lib/catalog/catalog-fetch-cache";
import { prefetchImageUrls } from "@/lib/ui/image-prefetch";

type ImageCarrier = {
  images?: { small?: string; large?: string } | null;
};

function warmImagesFromCards(cards: ImageCarrier[], limit = 96) {
  prefetchImageUrls(
    cards.map((c) => c.images?.small ?? c.images?.large),
    limit,
  );
}

/** Prefetch a catalog cards API page + artwork (JSON cache + image warm). */
export async function prefetchCatalogCardsPage<T extends ImageCarrier>(
  url: string,
  imageLimit = 96,
): Promise<void> {
  if (typeof window === "undefined") return;

  const cached = readCatalogCache<{ data: T[] }>(url);
  if (cached?.data?.length) {
    warmImagesFromCards(cached.data, imageLimit);
    void fetchCatalogJson<{ data: T[] }>(url)
      .then((fresh) => warmImagesFromCards(fresh.data ?? [], imageLimit))
      .catch(() => {});
    return;
  }

  try {
    const payload = await fetchCatalogJson<{ data: T[] }>(url);
    warmImagesFromCards(payload.data ?? [], imageLimit);
  } catch {
    /* ignore */
  }
}

/** Prefetch next page when paginating master catalog card grids. */
export function prefetchAdjacentCatalogPages(
  buildPageUrl: (page: number) => string | null,
  currentPage: number,
  totalPages: number,
) {
  if (typeof window === "undefined") return;
  if (totalPages <= 1 || currentPage >= totalPages) return;

  const nextUrl = buildPageUrl(currentPage + 1);
  if (nextUrl) void prefetchCatalogCardsPage(nextUrl);

  if (currentPage > 1) {
    const prevUrl = buildPageUrl(currentPage - 1);
    if (prevUrl) void prefetchCatalogCardsPage(prevUrl, 48);
  }
}
