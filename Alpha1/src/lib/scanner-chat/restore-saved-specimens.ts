import { buildScanCardContext } from "@/lib/scan/context-builder";
import { normalizeVisionCard } from "@/lib/scan/normalize-extracted-card";
import { normalizeVisionGridLocation } from "@/lib/scan/spatial";
import {
  extractedCardSchema,
  scanCardContextSchema,
  type ExtractedCard,
  type ScanCardContext,
} from "@/lib/scan/schemas";
import type { ScanSpecimen } from "@/hooks/use-scan-session";

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function restoreContext(
  specimenId: string,
  card: ExtractedCard,
  raw: unknown,
): ScanCardContext {
  const base =
    raw && typeof raw === "object"
      ? { ...(raw as Record<string, unknown>), specimenId }
      : { specimenId };
  const parsed = scanCardContextSchema.safeParse(base);
  if (parsed.success) {
    return { ...parsed.data, specimenId };
  }
  const catalogId =
    typeof (raw as { catalogId?: unknown })?.catalogId === "string"
      ? (raw as { catalogId: string }).catalogId
      : null;
  return buildScanCardContext({ specimenId, card, catalogId });
}

/** Rebuild in-memory scan specimens from saved `extracted_cards` rows. */
export function restoreSpecimensFromSaved(
  rows: ReadonlyArray<{ card: unknown; context?: unknown }>,
): ScanSpecimen[] {
  const next: ScanSpecimen[] = [];
  for (const row of rows) {
    const rawCard =
      row.card && typeof row.card === "object"
        ? row.card
        : (row as { raw_extraction_json?: { card?: unknown } }).raw_extraction_json?.card;
    const parsedCard = extractedCardSchema.safeParse(rawCard);
    const normalized = parsedCard.success
      ? parsedCard.data
      : normalizeVisionCard(rawCard && typeof rawCard === "object" ? rawCard : {});
    if (!normalized) continue;

    const rawContext =
      row.context && typeof row.context === "object"
        ? row.context
        : (row as { raw_extraction_json?: { context?: unknown } }).raw_extraction_json?.context;

    const specimenId = makeId("specimen");
    const context = restoreContext(specimenId, normalized, rawContext);
    const evidenceCropLocation =
      normalizeVisionGridLocation(normalized.location) ?? null;

    next.push({
      id: specimenId,
      card: normalized,
      context: { ...context, specimenId },
      previewUrl: null,
      evidenceCropLocation,
      userEvidenceCropCenter: null,
      userEvidenceCropRadiusMultiplier: null,
    });
  }
  return next;
}
