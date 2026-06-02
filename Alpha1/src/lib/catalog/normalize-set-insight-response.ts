import type { CatalogSetInsightPayload } from "@/lib/catalog/set-insight-payload";

/** Client-side normalization so partial API bodies still render priced sets. */
export function normalizeSetInsightResponse(
  body: CatalogSetInsightPayload & { error?: string },
  setName: string,
): CatalogSetInsightPayload {
  const pricedFromApi = (body.setWide?.pricedSlots ?? 0) > 0;
  if (body.ready || !pricedFromApi) {
    return body.ready ? body : { ...body, ready: true };
  }
  return {
    ...body,
    ready: true,
    summary:
      body.summary ??
      `${setName}: ${body.setWide.pricedSlots} of ${body.setWide.cardCount} cards priced from catalog.`,
  };
}
