import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { catalogImageLookupName, localizedPrintedName } from "@/lib/scan/card-display";

const warmed = new Set<string>();

/** Warm `/api/pokedex/catalog-thumb` cache as soon as vision identity is known. */
export function prefetchCatalogThumbsForSpecimens(
  specimens: ScanSpecimen[],
  limit = 24,
): void {
  if (typeof window === "undefined") return;

  for (const specimen of specimens.slice(0, limit)) {
    const card = specimen.card;
    const name = catalogImageLookupName(card);
    if (!name || name === "—") continue;

    const key = [
      specimen.id,
      name,
      card.set ?? "",
      card.number ?? "",
      card.printStamps ?? "",
    ].join("|");
    if (warmed.has(key)) continue;
    warmed.add(key);

    const q = new URLSearchParams({ name });
    if (card.set?.trim()) q.set("set", card.set.trim());
    if (card.number?.trim()) q.set("number", card.number.trim());
    if (card.printStamps?.trim()) q.set("printStamps", card.printStamps.trim());
    const printed = localizedPrintedName(card);
    if (printed) q.set("printedName", printed);
    if (card.language?.trim()) q.set("language", card.language.trim());

    void fetch(`/api/pokedex/catalog-thumb?${q}`, { credentials: "same-origin" }).catch(
      () => {},
    );
  }
}
