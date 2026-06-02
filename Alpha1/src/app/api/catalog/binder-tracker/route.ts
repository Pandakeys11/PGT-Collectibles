import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAppUser, syncCurrentAppUser } from "@/lib/auth/app-user";
import {
  listBinderOwnedForSet,
  setBinderCardOwned,
} from "@/lib/catalog/binder-tracker-persist";
import { formatBinderTrackerError } from "@/lib/catalog/binder-tracker-errors";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

function binderTrackerErrorResponse(err: unknown, status = 500) {
  const formatted = formatBinderTrackerError(err);
  return NextResponse.json(
    {
      error: formatted.message,
      code: formatted.code,
      setupHint: formatted.setupHint,
    },
    { status: formatted.code === "TABLE_NOT_READY" ? 503 : status },
  );
}

const patchSchema = z.object({
  setId: z.string().trim().min(1).max(120),
  catalogId: z.string().trim().min(1).max(200),
  owned: z.boolean(),
});

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ signedIn: false, ownedCatalogIds: [], totalOwned: 0 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const setId = req.nextUrl.searchParams.get("setId")?.trim() ?? "";
  if (!setId) {
    return NextResponse.json({ error: "setId is required" }, { status: 400 });
  }

  const appUser = (await getCurrentAppUser()) ?? (await syncCurrentAppUser());
  if (!appUser) {
    return NextResponse.json({ error: "User sync failed" }, { status: 503 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const ownedCatalogIds = await listBinderOwnedForSet(supabase, appUser.id, setId);
    return NextResponse.json({
      signedIn: true,
      setId,
      email: appUser.email,
      ownedCatalogIds,
      totalOwned: ownedCatalogIds.length,
    });
  } catch (err) {
    return binderTrackerErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  await auth.protect();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const appUser = (await getCurrentAppUser()) ?? (await syncCurrentAppUser());
  if (!appUser) {
    return NextResponse.json({ error: "User sync failed" }, { status: 503 });
  }

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid binder tracker payload" },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    await setBinderCardOwned({
      supabase,
      userId: appUser.id,
      setId: payload.setId,
      catalogId: payload.catalogId,
      owned: payload.owned,
    });
    const ownedCatalogIds = await listBinderOwnedForSet(supabase, appUser.id, payload.setId);
    return NextResponse.json({
      ok: true,
      setId: payload.setId,
      catalogId: payload.catalogId,
      owned: payload.owned,
      email: appUser.email,
      ownedCatalogIds,
      totalOwned: ownedCatalogIds.length,
    });
  } catch (err) {
    return binderTrackerErrorResponse(err);
  }
}
