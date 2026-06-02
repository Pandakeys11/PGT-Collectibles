import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import {
  listDigitalScanAssetsForSession,
  listDigitalScanAssetsForUser,
  persistDigitalScanAssets,
  publicScanVaultUrl,
  SCAN_VAULT_BUCKET,
} from "@/lib/digital-scan/persist-digital-scans";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

const uploadSchema = z.object({
  sessionId: z.string().uuid(),
  assets: z
    .array(
      z.object({
        specimenKey: z.string().min(1).max(120),
        filename: z.string().min(1).max(200),
        mime: z.enum(["image/jpeg", "image/png"]),
        width: z.number().int().min(1),
        height: z.number().int().min(1),
        cardIndexOnPage: z.number().int().min(1),
        lane: z.enum(["raw", "graded"]),
        catalogId: z.string().nullable().optional(),
        sidecar: z.record(z.string(), z.unknown()),
        imageBase64: z.string().min(32).max(12_000_000),
        extractedCardId: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1)
    .max(120),
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

  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim();
  const limit = Math.min(
    500,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 200) || 200),
  );

  const supabase = getSupabaseAdmin();
  const rows = sessionId
    ? await listDigitalScanAssetsForSession(supabase, appUser.id, sessionId)
    : await listDigitalScanAssetsForUser(supabase, appUser.id, limit);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";

  return NextResponse.json({
    bucket: SCAN_VAULT_BUCKET,
    assets: rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      specimenKey: row.specimen_key,
      filename: row.filename,
      mime: row.mime,
      width: row.width,
      height: row.height,
      cardIndexOnPage: row.card_index_on_page,
      lane: row.lane,
      catalogId: row.catalog_id,
      sidecar: row.sidecar_json,
      contentSha256: row.content_sha256,
      createdAt: row.created_at,
      publicUrl: supabaseUrl ? publicScanVaultUrl(supabaseUrl, row.storage_path) : null,
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

  let payload: z.infer<typeof uploadSchema>;
  try {
    payload = uploadSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid upload payload" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: sessionRow, error: sessionError } = await supabase
    .from("scan_sessions")
    .select("id")
    .eq("id", payload.sessionId)
    .eq("user_id", appUser.id)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    return NextResponse.json({ error: "Scan session not found" }, { status: 404 });
  }

  try {
    const { savedCount, paths } = await persistDigitalScanAssets(supabase, {
      userId: appUser.id,
      sessionId: payload.sessionId,
      uploads: payload.assets.map((a) => ({
        specimenKey: a.specimenKey,
        filename: a.filename,
        mime: a.mime,
        width: a.width,
        height: a.height,
        cardIndexOnPage: a.cardIndexOnPage,
        lane: a.lane,
        catalogId: a.catalogId ?? null,
        sidecar: a.sidecar as import("@/lib/digital-scan/types").DigitalScanSidecar,
        imageBase64: a.imageBase64,
        extractedCardId: a.extractedCardId ?? null,
      })),
    });

    return NextResponse.json({ ok: true, savedCount, paths });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
