import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import {
  clearAllSessionsForUser,
  persistSessionSpecimens,
} from "@/lib/saved/persist-scan-session";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
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

  try {
    const { savedCount } = await persistSessionSpecimens(supabase, {
      userId: appUser.id,
      sessionId: (session as { id: string }).id,
      specimens: payload.specimens,
    });

    await supabase.from("usage_ledger").insert({
      user_id: appUser.id,
      event_type: "scan_session_save",
      credits_used: 0,
      route: "/api/saved/sessions",
      metadata_json: {
        sessionId: (session as { id: string }).id,
        savedCount,
      },
    });

    return NextResponse.json({
      ok: true,
      sessionId: (session as { id: string }).id,
      savedCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 },
    );
  }
}

/** Remove all saved scan sessions for the signed-in user. */
export async function DELETE() {
  await auth.protect();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const appUser = await syncCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "User sync failed" }, { status: 503 });
  }

  try {
    const deleted = await clearAllSessionsForUser(getSupabaseAdmin(), appUser.id);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Clear failed" },
      { status: 500 },
    );
  }
}
