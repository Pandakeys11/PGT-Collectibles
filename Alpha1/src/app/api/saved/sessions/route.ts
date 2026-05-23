import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import { analyzeMarketEvidence } from "@/lib/market/market-intelligence";
import { marketIdentityHash } from "@/lib/market/identity-hash";
import {
  linkExtractedCardToIdentity,
  recordPgtObservation,
  upsertPgtCardIdentity,
} from "@/lib/pgt-registry/persist";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { normalizeGradedSlabFields } from "@/lib/scan/graded-slab";
import { classifyCardLane } from "@/lib/scan/lane";
import { franchiseLabel } from "@/lib/scan/franchise";
import { extractedCardSchema } from "@/lib/scan/schemas";

const LIST_LIMIT = 40;

const saveSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  specimens: z
    .array(
      z.object({
        card: extractedCardSchema,
        context: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export async function GET(req: NextRequest) {
  await auth.protect();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const appUser = await syncCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "User sync failed" }, { status: 503 });
  }

  const limit = Math.min(
    100,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? LIST_LIMIT) || LIST_LIMIT),
  );

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scan_sessions")
    .select("id, title, specimen_count, created_at, updated_at")
    .eq("user_id", appUser.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    sessions: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      specimenCount: row.specimen_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  await auth.protect();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const appUser = await syncCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "User sync failed" }, { status: 503 });
  }

  let payload: z.infer<typeof saveSessionSchema>;
  try {
    payload = saveSessionSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid save payload" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: session, error: sessionError } = await supabase
    .from("scan_sessions")
    .insert({
      user_id: appUser.id,
      title: payload.title || `Scan ${new Date().toLocaleDateString("en-US")}`,
      specimen_count: payload.specimens.length,
    })
    .select("id")
    .single();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  const rows = payload.specimens.map((item) => {
    const lane = classifyCardLane(item.card).lane;
    const card = normalizeGradedSlabFields(item.card, lane);
    return {
      user_id: appUser.id,
      session_id: (session as { id: string }).id,
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
  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 });
  }

  await Promise.all(
    payload.specimens.map(async (item, index) => {
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
        userId: appUser.id,
        pgtCardIdentityId: identityId,
        sessionId: (session as { id: string }).id,
        extractedCardId: extractedId ?? null,
        eventType: "session_save",
        card,
        context: (item.context ?? {}) as Record<string, unknown>,
      });
    }),
  );

  const snapshotRows = payload.specimens.map((item, index) => {
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
      user_id: appUser.id,
      session_id: (session as { id: string }).id,
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
    await supabase.from("market_snapshots").insert(snapshotRows);
  }

  await supabase.from("usage_ledger").insert({
    user_id: appUser.id,
    event_type: "scan_session_save",
    credits_used: 0,
    route: "/api/saved/sessions",
    metadata_json: {
      sessionId: (session as { id: string }).id,
      savedCount: rows.length,
    },
  });

  return NextResponse.json({
    ok: true,
    sessionId: (session as { id: string }).id,
    savedCount: rows.length,
  });
}
