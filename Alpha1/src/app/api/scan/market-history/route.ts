import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import { marketIdentityHash } from "@/lib/market/identity-hash";
import { isMissingRelationError } from "@/lib/market/supabase-errors";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { extractedCardSchema } from "@/lib/scan/schemas";

export async function POST(req: NextRequest) {
  await auth.protect();

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { identityHash: null, snapshots: [], available: false },
      { status: 200 },
    );
  }

  const raw = await req.text();
  if (!raw.trim()) {
    return NextResponse.json({ error: "Empty request body" }, { status: 400 });
  }

  let body: { card?: unknown; limit?: number };
  try {
    body = JSON.parse(raw) as { card?: unknown; limit?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = extractedCardSchema.safeParse(body.card);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid card payload" }, { status: 400 });
  }

  const appUser = await syncCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "User sync failed" }, { status: 503 });
  }

  const limit = Math.min(Math.max(Number(body.limit ?? 30), 1), 90);
  const identityHash = marketIdentityHash(parsed.data);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("market_snapshots")
    .select(
      "id, grade_bucket, fmv_usd, fmv_basis, confidence, sold_count, active_count, reference_count, auction_count, buy_now_count, bucket_summary_json, captured_at",
    )
    .eq("user_id", appUser.id)
    .eq("identity_hash", identityHash)
    .order("captured_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingRelationError(error)) {
      return NextResponse.json({
        identityHash,
        snapshots: [],
        available: false,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    identityHash,
    snapshots: data ?? [],
    available: true,
  });
}
