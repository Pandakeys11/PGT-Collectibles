import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  await auth.protect();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const appUser = await syncCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "User sync failed" }, { status: 503 });
  }

  const { sessionId } = await context.params;
  if (!sessionId?.trim()) {
    return NextResponse.json({ error: "Session id required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: session, error: sessionError } = await supabase
    .from("scan_sessions")
    .select("id, title, specimen_count, created_at, updated_at")
    .eq("id", sessionId)
    .eq("user_id", appUser.id)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { data: cards, error: cardsError } = await supabase
    .from("extracted_cards")
    .select("id, raw_extraction_json, created_at")
    .eq("session_id", sessionId)
    .eq("user_id", appUser.id)
    .order("created_at", { ascending: true });

  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 });
  }

  const specimens = (cards ?? []).map((row) => {
    const raw = row.raw_extraction_json as { card?: unknown; context?: unknown } | null;
    return {
      card: raw?.card ?? {},
      context: raw?.context ?? {},
    };
  });

  return NextResponse.json({
    session: {
      id: session.id,
      title: session.title,
      specimenCount: session.specimen_count,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    },
    specimens,
  });
}
