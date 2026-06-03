import {
  cosineSimilarity,
  embedArtImage,
  fetchCatalogImageBase64,
} from "@/lib/catalog/art-embedding";
import { loadArtEmbeddings, upsertArtEmbedding } from "@/lib/catalog/art-embedding-store";
import { searchDbCatalogBroad } from "@/lib/catalog/db-catalog";
import { buildCatalogMatch } from "@/lib/market/catalog-match-utils";
import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import { isArtMatchEnabled } from "@/lib/ai/env";
import { effectiveCatalogSearchName } from "@/lib/scan/card-display";
import type { CardFranchise } from "@/lib/scan/franchise";
import type { CatalogCandidate, ExtractedCard, IdentityEvidence } from "@/lib/scan/schemas";

const MAX_ART_POOL = 12;
const MAX_LAZY_EMBED = 6;
const ART_WEIGHT = 0.58;
const TEXT_WEIGHT = 0.42;
/** Cosine similarity floor to include a row in art-ranked results. */
const MIN_ART_SIM = 0.68;
/** Auto-promote to likely when art is strong and text has no hard conflicts. */
const ART_LIKELY_SIM = 0.82;
const ART_CONFIRM_SIM = 0.88;
const ART_CONFIRM_GAP = 0.06;

export type ArtMatchImage = {
  base64: string;
  mimeType: string;
};

function hardConflictCount(row: CatalogCandidate): number {
  return row.conflicts.filter((c) => /^(name|number|print_variant)$/i.test(c)).length;
}

function mergeArtTextScore(textScore: number, artSim: number): number {
  const textNorm = Math.max(0, Math.min(1, textScore / 100));
  const artNorm = Math.max(0, Math.min(1, artSim));
  return Math.round((textNorm * TEXT_WEIGHT + artNorm * ART_WEIGHT) * 100);
}

function buildArtEvidence(topSim: number, poolSize: number): IdentityEvidence[] {
  return [
    {
      field: "artwork_similarity",
      extracted: "scan crop",
      catalog: `${poolSize} catalog art vectors`,
      status: topSim >= ART_LIKELY_SIM ? "match" : "info",
      weight: Math.round(topSim * 100),
      reason: `Visual embedding similarity ${(topSim * 100).toFixed(0)}% vs master catalog art.`,
    },
  ];
}

function resolveArtStatus(
  top: CatalogCandidate,
  topArtSim: number,
  runnerUpArtSim: number | undefined,
): CatalogMatch["catalogIdentityStatus"] {
  const artGap = topArtSim - (runnerUpArtSim ?? 0);
  if (hardConflictCount(top) > 0) return "ambiguous";
  if (topArtSim >= ART_CONFIRM_SIM && artGap >= ART_CONFIRM_GAP && top.score >= 78) {
    return "confirmed";
  }
  if (topArtSim >= ART_LIKELY_SIM && top.score >= 65) return "likely";
  if (topArtSim >= MIN_ART_SIM) return "ambiguous";
  return "failed";
}

async function ensureEmbeddingsForCandidates(args: {
  franchise: CardFranchise;
  candidates: CatalogCandidate[];
  cached: Map<string, { embedding: number[] }>;
}): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  for (const [catalogId, row] of args.cached) {
    out.set(catalogId, row.embedding);
  }

  let lazyBudget = MAX_LAZY_EMBED;
  for (const candidate of args.candidates) {
    if (out.has(candidate.catalogId)) continue;
    if (lazyBudget <= 0) break;
    lazyBudget -= 1;

    const imageUrl = candidate.imageLargeUrl ?? candidate.imageSmallUrl;
    if (!imageUrl) continue;

    const image = await fetchCatalogImageBase64(imageUrl);
    if (!image) continue;

    const textLabel = [candidate.name, candidate.setName, candidate.cardNumber]
      .filter(Boolean)
      .join(" · ");
    const embedding = await embedArtImage({
      base64: image.base64,
      mimeType: image.mimeType,
      task: "document",
      textLabel,
    });
    if (!embedding) continue;

    out.set(candidate.catalogId, embedding);
    void upsertArtEmbedding({
      franchise: args.franchise,
      catalogId: candidate.catalogId,
      embedding,
      imageUrl,
    });
  }

  return out;
}

function poolFromTextMatch(textMatch: CatalogMatch | null): CatalogCandidate[] {
  if (!textMatch?.candidates.length) return [];
  return textMatch.candidates.slice(0, MAX_ART_POOL);
}

/**
 * Art-first catalog disambiguation: embed scan crop, compare to cached catalog art vectors.
 * Narrows/reorders text-match candidates (eBay-style shortlist).
 */
export async function matchCatalogByArt(args: {
  card: ExtractedCard;
  franchise: CardFranchise;
  image: ArtMatchImage;
  textMatch?: CatalogMatch | null;
}): Promise<CatalogMatch | null> {
  if (!isArtMatchEnabled()) return null;

  const name = effectiveCatalogSearchName(args.card);
  if (!name || name.length < 2) return null;

  let pool = poolFromTextMatch(args.textMatch ?? null);
  if (pool.length < 2) {
    const broad = await searchDbCatalogBroad(args.card, args.franchise);
    pool = broad?.candidates.slice(0, MAX_ART_POOL) ?? [];
  }
  if (pool.length < 2) return null;

  const queryEmbedding = await embedArtImage({
    base64: args.image.base64,
    mimeType: args.image.mimeType,
    task: "query",
    textLabel: [name, args.card.set, args.card.number].filter(Boolean).join(" · "),
  });
  if (!queryEmbedding) return null;

  const catalogIds = pool.map((row) => row.catalogId);
  const cached = await loadArtEmbeddings({
    franchise: args.franchise,
    catalogIds,
  });
  const embeddings = await ensureEmbeddingsForCandidates({
    franchise: args.franchise,
    candidates: pool,
    cached,
  });

  const scored: Array<{ candidate: CatalogCandidate; artSim: number; score: number }> = [];
  for (const candidate of pool) {
    const vector = embeddings.get(candidate.catalogId);
    if (!vector) continue;
    const artSim = cosineSimilarity(queryEmbedding, vector);
    if (artSim < MIN_ART_SIM) continue;
    const mergedScore = mergeArtTextScore(candidate.score, artSim);
    scored.push({
      candidate: {
        ...candidate,
        score: mergedScore,
        confidence: mergedScore / 100,
        reasons: [...candidate.reasons.filter((r) => r !== "artwork_similarity"), "artwork_similarity"],
        conflicts: candidate.conflicts,
      },
      artSim,
      score: mergedScore,
    });
  }

  if (scored.length === 0) return null;

  scored.sort(
    (a, b) =>
      b.artSim - a.artSim ||
      b.score - a.score ||
      hardConflictCount(a.candidate) - hardConflictCount(b.candidate),
  );

  const candidates = scored.map((row) => row.candidate).slice(0, 8);
  const top = candidates[0]!;
  const topArtSim = scored[0]!.artSim;
  const runnerUpArtSim = scored[1]?.artSim;
  const evidence = buildArtEvidence(topArtSim, pool.length);
  const status = resolveArtStatus(top, topArtSim, runnerUpArtSim);

  const rows = candidates.map((candidate) => ({
    catalogId: candidate.catalogId,
    name: candidate.name,
    setName: candidate.setName,
    cardNumber: candidate.cardNumber,
    year: candidate.year,
    rarity: candidate.rarity,
    score: candidate.score,
    confidence: candidate.confidence,
    reasons: candidate.reasons,
    conflicts: candidate.conflicts,
    imageSmallUrl: candidate.imageSmallUrl,
    imageLargeUrl: candidate.imageLargeUrl,
  }));

  const match = buildCatalogMatch(rows, evidence, "strict");
  if (!match) return null;

  return {
    ...match,
    catalogId: status === "confirmed" ? top.catalogId : (match.catalogId ?? null),
    catalogIdentityStatus: status,
    catalogConfidence: top.confidence,
    score: top.score,
    imageSmallUrl: top.imageSmallUrl,
    imageLargeUrl: top.imageLargeUrl,
    imageUrl: top.imageLargeUrl ?? top.imageSmallUrl,
    name: top.name,
    setName: top.setName,
    cardNumber: top.cardNumber,
    year: top.year,
    rarity: top.rarity,
  };
}
