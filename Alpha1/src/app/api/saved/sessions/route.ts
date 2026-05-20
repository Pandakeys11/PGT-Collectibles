import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { normalizeGradedSlabFields } from "@/lib/scan/graded-slab";
import { classifyCardLane } from "@/lib/scan/lane";
import { extractedCardSchema } from "@/lib/scan/schemas";

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

  const { error: cardsError } = await supabase.from("extracted_cards").insert(rows);
  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 });
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
