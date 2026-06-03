import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeMarketEvidence } from "@/lib/market/market-intelligence";
import { marketIdentityHash } from "@/lib/market/identity-hash";
import {
  linkExtractedCardToIdentity,
  recordPgtObservation,
  upsertPgtCardIdentity,
} from "@/lib/pgt-registry/persist";
import { franchiseLabel } from "@/lib/scan/franchise";
import { normalizeGradedSlabFields } from "@/lib/scan/graded-slab";
import { classifyCardLane } from "@/lib/scan/lane";
import type { ExtractedCard } from "@/lib/scan/schemas";

export type SessionSpecimenInput = {
  card: ExtractedCard;
  context?: Record<string, unknown>;
};

export async function persistSessionSpecimens(
  supabase: SupabaseClient,
  args: {
    userId: string;
    sessionId: string;
    specimens: SessionSpecimenInput[];
  },
): Promise<{ savedCount: number }> {
  const rows = args.specimens.map((item) => {
    const lane = classifyCardLane(item.card).lane;
    const card = normalizeGradedSlabFields(item.card, lane);
    return {
      user_id: args.userId,
      session_id: args.sessionId,
      name: card.name,
      printed_name: card.printedName ?? null,
      language: card.language ?? null,
      set_name: card.set ?? null,
      card_number: card.number ?? null,
      year: card.year ?? null,
      rarity: card.rarity ?? null,
      print_stamps: card.printStamps ?? null,
      grader: card.grader ?? null,
      grade: card.grade ?? null,
      cert: card.cert ?? null,
      catalog_id: typeof item.context?.catalogId === "string" ? item.context.catalogId : null,
      catalog_confidence:
        typeof item.context?.catalogConfidence === "number" ? item.context.catalogConfidence : null,
      market_snapshot_json: {
        fairValueUsd: item.context?.fairValueUsd ?? null,
        fairValueBasis: item.context?.fairValueBasis ?? null,
        askingUsd: item.context?.askingUsd ?? card.extractedPrice ?? null,
        marketEvidence: item.context?.marketEvidence ?? [],
        marketSourceLinks: item.context?.marketSourceLinks ?? [],
      },
      raw_extraction_json: {
        card,
        context: item.context ?? {},
      },
    };
  });

  const { data: insertedCards, error: cardsError } = await supabase
    .from("extracted_cards")
    .insert(rows)
    .select("id");
  if (cardsError) throw new Error(cardsError.message);

  await Promise.all(
    args.specimens.map(async (item, index) => {
      const lane = classifyCardLane(item.card).lane;
      const card = normalizeGradedSlabFields(item.card, lane);
      const catalogId =
        typeof item.context?.catalogId === "string" ? item.context.catalogId : null;
      const identityId = await upsertPgtCardIdentity(card, catalogId);
      const extractedId = (insertedCards?.[index] as { id?: string } | undefined)?.id;
      if (identityId && extractedId) {
        await linkExtractedCardToIdentity(extractedId, identityId);
      }
      await recordPgtObservation({
        userId: args.userId,
        pgtCardIdentityId: identityId,
        sessionId: args.sessionId,
        extractedCardId: extractedId ?? null,
        eventType: "session_save",
        card,
        context: item.context ?? {},
      });
    }),
  );

  const snapshotRows = args.specimens.map((item, index) => {
    const context = item.context ?? {};
    const evidence = Array.isArray(context.marketEvidence) ? context.marketEvidence : [];
    const card = normalizeGradedSlabFields(item.card, classifyCardLane(item.card).lane);
    const intel = analyzeMarketEvidence(evidence, {
      card,
      gradeCard: card,
      stickerUsd:
        typeof context.askingUsd === "number"
          ? context.askingUsd
          : typeof card.extractedPrice === "number"
            ? card.extractedPrice
            : null,
    });
    return {
      user_id: args.userId,
      session_id: args.sessionId,
      extracted_card_id: (insertedCards?.[index] as { id?: string } | undefined)?.id ?? null,
      identity_hash: marketIdentityHash(card),
      franchise: card.franchise ?? franchiseLabel(card),
      card_name: card.name,
      set_name: card.set ?? null,
      card_number: card.number ?? null,
      year: card.year ?? null,
      variant_label:
        [card.language, card.printedName, card.printStamps, card.details, card.rarity]
          .filter(Boolean)
          .join(" · ") || null,
      grade_bucket: intel.targetBucket,
      fmv_usd: intel.fmvUsd,
      fmv_basis: intel.fmvBasis,
      confidence: intel.confidence,
      sold_count: intel.soldCount,
      active_count: intel.activeCount,
      reference_count: intel.referenceCount,
      auction_count: intel.auctionCount,
      buy_now_count: intel.buyNowCount,
      evidence_json: evidence,
      bucket_summary_json: intel.buckets,
      source_summary_json: context.marketSourceLinks ?? [],
      captured_at: new Date().toISOString(),
    };
  });

  if (snapshotRows.length > 0) {
    const { error } = await supabase.from("market_snapshots").insert(snapshotRows);
    if (error) throw new Error(error.message);
  }

  return { savedCount: rows.length };
}

export async function deleteSessionForUser(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<void> {
  await supabase.from("market_snapshots").delete().eq("session_id", sessionId).eq("user_id", userId);
  await supabase.from("extracted_cards").delete().eq("session_id", sessionId).eq("user_id", userId);
  const { error } = await supabase
    .from("scan_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function clearAllSessionsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data: sessions, error: listError } = await supabase
    .from("scan_sessions")
    .select("id")
    .eq("user_id", userId);
  if (listError) throw new Error(listError.message);
  const ids = (sessions ?? []).map((r) => r.id as string);
  if (ids.length === 0) return 0;

  await supabase.from("market_snapshots").delete().eq("user_id", userId);
  await supabase.from("extracted_cards").delete().eq("user_id", userId).in("session_id", ids);
  const { error } = await supabase.from("scan_sessions").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
  return ids.length;
}

export async function appendSessionSpecimens(
  supabase: SupabaseClient,
  args: {
    userId: string;
    sessionId: string;
    specimens: SessionSpecimenInput[];
  },
): Promise<{ savedCount: number; specimenCount: number }> {
  const { data: session, error: sessionError } = await supabase
    .from("scan_sessions")
    .select("specimen_count")
    .eq("id", args.sessionId)
    .eq("user_id", args.userId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Session not found");

  const { savedCount } = await persistSessionSpecimens(supabase, {
    userId: args.userId,
    sessionId: args.sessionId,
    specimens: args.specimens,
  });

  const specimenCount = (session.specimen_count ?? 0) + savedCount;
  const { error: updateError } = await supabase
    .from("scan_sessions")
    .update({ specimen_count: specimenCount, updated_at: new Date().toISOString() })
    .eq("id", args.sessionId)
    .eq("user_id", args.userId);
  if (updateError) throw new Error(updateError.message);

  return { savedCount, specimenCount };
}

export async function replaceSessionSpecimens(
  supabase: SupabaseClient,
  args: {
    userId: string;
    sessionId: string;
    title?: string;
    specimens: SessionSpecimenInput[];
  },
): Promise<{ savedCount: number }> {
  await supabase.from("market_snapshots").delete().eq("session_id", args.sessionId).eq("user_id", args.userId);
  await supabase.from("extracted_cards").delete().eq("session_id", args.sessionId).eq("user_id", args.userId);

  const patch: Record<string, unknown> = {
    specimen_count: args.specimens.length,
    updated_at: new Date().toISOString(),
  };
  if (args.title?.trim()) patch.title = args.title.trim();

  const { error: sessionError } = await supabase
    .from("scan_sessions")
    .update(patch)
    .eq("id", args.sessionId)
    .eq("user_id", args.userId);
  if (sessionError) throw new Error(sessionError.message);

  return persistSessionSpecimens(supabase, {
    userId: args.userId,
    sessionId: args.sessionId,
    specimens: args.specimens,
  });
}
