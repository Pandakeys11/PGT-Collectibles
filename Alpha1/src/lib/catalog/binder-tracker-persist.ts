import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatBinderTrackerError } from "@/lib/catalog/binder-tracker-errors";

function throwBinderPersistError(error: { message: string; code?: string }): never {
  const formatted = formatBinderTrackerError(error);
  const err = new Error(formatted.message);
  if (formatted.code) {
    (err as Error & { code?: string }).code = formatted.code;
  }
  if (formatted.setupHint) {
    (err as Error & { setupHint?: string }).setupHint = formatted.setupHint;
  }
  throw err;
}

export type BinderTrackerSnapshot = {
  setId: string;
  ownedCatalogIds: string[];
  totalOwned: number;
  email: string | null;
};

export async function listBinderOwnedForSet(
  supabase: SupabaseClient,
  userId: string,
  setId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("catalog_binder_owned_cards")
    .select("catalog_id")
    .eq("user_id", userId)
    .eq("set_id", setId);

  if (error) throwBinderPersistError(error);
  return (data ?? []).map((row) => row.catalog_id as string);
}

export async function setBinderCardOwned(args: {
  supabase: SupabaseClient;
  userId: string;
  setId: string;
  catalogId: string;
  owned: boolean;
}): Promise<void> {
  if (args.owned) {
    const { error } = await args.supabase.from("catalog_binder_owned_cards").upsert(
      {
        user_id: args.userId,
        set_id: args.setId,
        catalog_id: args.catalogId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,catalog_id" },
    );
    if (error) throwBinderPersistError(error);
    return;
  }

  const { error } = await args.supabase
    .from("catalog_binder_owned_cards")
    .delete()
    .eq("user_id", args.userId)
    .eq("catalog_id", args.catalogId);

  if (error) throwBinderPersistError(error);
}
