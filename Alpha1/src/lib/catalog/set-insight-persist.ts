import { getSetInsightCacheTtlMs } from "@/lib/ai/research-budget";
import type { CatalogSetInsightPayload } from "@/lib/catalog/set-insight-payload";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

const FRANCHISE = "pokemon";

export async function readPersistedSetInsight(
  setId: string,
): Promise<CatalogSetInsightPayload | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("tcg_catalog_set_insights")
      .select("payload, refreshed_at, ready")
      .eq("franchise", FRANCHISE)
      .eq("set_id", setId)
      .maybeSingle();
    if (error || !data?.payload || data.ready !== true) return null;

    const refreshedAt = data.refreshed_at ? new Date(data.refreshed_at).getTime() : 0;
    if (!refreshedAt || Date.now() - refreshedAt > getSetInsightCacheTtlMs()) {
      return null;
    }

    const payload = data.payload as CatalogSetInsightPayload;
    if (!payload?.setId || payload.setId !== setId) return null;
    return { ...payload, ready: true };
  } catch {
    return null;
  }
}

export async function persistSetInsight(payload: CatalogSetInsightPayload): Promise<void> {
  if (!isSupabaseConfigured() || !payload.ready) return;
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    await supabase.from("tcg_catalog_set_insights").upsert(
      {
        franchise: FRANCHISE,
        set_id: payload.setId,
        payload,
        source: payload.source,
        model: payload.model ?? null,
        ready: true,
        refreshed_at: payload.refreshedAt ?? now,
        updated_at: now,
      },
      { onConflict: "franchise,set_id" },
    );
  } catch {
    // Non-fatal — in-memory cache still serves warm instances.
  }
}
