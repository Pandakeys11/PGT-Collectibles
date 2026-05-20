import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth/app-user";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

const updateSavedCardSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  set_name: z.string().trim().max(160).nullable().optional(),
  card_number: z.string().trim().max(64).nullable().optional(),
  year: z.string().trim().max(16).nullable().optional(),
  rarity: z.string().trim().max(80).nullable().optional(),
  print_stamps: z.string().trim().max(200).nullable().optional(),
  grader: z.string().trim().max(32).nullable().optional(),
  grade: z.string().trim().max(32).nullable().optional(),
  cert: z.string().trim().max(80).nullable().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  await auth.protect();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const { id } = await context.params;
  const cardId = id.trim();
  if (!cardId) {
    return NextResponse.json({ error: "Card id is required" }, { status: 400 });
  }

  let payload: z.infer<typeof updateSavedCardSchema>;
  try {
    payload = updateSavedCardSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid card update" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("extracted_cards")
    .update(payload)
    .eq("id", cardId)
    .eq("user_id", appUser.id)
    .select(
      "id, name, printed_name, language, set_name, card_number, year, rarity, print_stamps, grader, grade, cert, catalog_id, catalog_confidence, market_snapshot_json, raw_extraction_json, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ card: data });
}
