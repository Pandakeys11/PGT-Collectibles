import "server-only";

import type { SlabzCard, SlabzRipRecord, SlabzTransactionStatus } from "@/lib/slabz/types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

type RipRow = {
  id: string;
  user_id: string;
  slabz_transaction_id: string;
  pack_id: string;
  pack_name: string | null;
  status: string;
  wallet_address: string;
  price_cents: number | null;
  card: SlabzCard | null;
  created_at: string;
  updated_at: string;
};

function isMissingSlabzTableError(error: { code?: string; message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (msg.includes("user_slabz") &&
      (msg.includes("does not exist") || msg.includes("not found") || msg.includes("schema cache")))
  );
}

function rowToRip(row: RipRow): SlabzRipRecord {
  return {
    id: row.id,
    slabzTransactionId: row.slabz_transaction_id,
    packId: row.pack_id,
    packName: row.pack_name,
    status: row.status as SlabzTransactionStatus,
    walletAddress: row.wallet_address,
    priceCents: row.price_cents,
    card: row.card,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSlabzWalletForUser(userId: string): Promise<{
  walletAddress: string;
  network: "devnet" | "mainnet";
} | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_slabz_wallets")
    .select("wallet_address, network")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSlabzTableError(error)) return null;
    throw error;
  }
  if (!data?.wallet_address) return null;
  return {
    walletAddress: data.wallet_address,
    network: data.network === "mainnet" ? "mainnet" : "devnet",
  };
}

export async function clearSlabzWalletForUser(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("user_slabz_wallets").delete().eq("user_id", userId);
  if (error && !isMissingSlabzTableError(error)) throw error;
}

export async function saveSlabzWalletForUser(
  userId: string,
  walletAddress: string,
  network: "devnet" | "mainnet",
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("user_slabz_wallets").upsert(
    {
      user_id: userId,
      wallet_address: walletAddress,
      network,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error && !isMissingSlabzTableError(error)) throw error;
}

export async function listSlabzRipsForUser(
  userId: string,
  limit = 24,
): Promise<SlabzRipRecord[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_slabz_rips")
    .select(
      "id, user_id, slabz_transaction_id, pack_id, pack_name, status, wallet_address, price_cents, card, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingSlabzTableError(error)) return [];
    throw error;
  }
  return (data as RipRow[] | null)?.map(rowToRip) ?? [];
}

export async function patchSlabzRipStatus(
  userId: string,
  slabzTransactionId: string,
  status: SlabzTransactionStatus,
  card?: SlabzCard | null,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (card !== undefined) patch.card = card;

  const { error } = await supabase
    .from("user_slabz_rips")
    .update(patch)
    .eq("user_id", userId)
    .eq("slabz_transaction_id", slabzTransactionId);

  if (error && !isMissingSlabzTableError(error)) throw error;
}

export async function upsertSlabzRip(
  userId: string,
  input: {
    slabzTransactionId: string;
    packId: string;
    packName?: string | null;
    status: SlabzTransactionStatus;
    walletAddress: string;
    priceCents?: number | null;
    card?: SlabzCard | null;
  },
): Promise<SlabzRipRecord | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_slabz_rips")
    .upsert(
      {
        user_id: userId,
        slabz_transaction_id: input.slabzTransactionId,
        pack_id: input.packId,
        pack_name: input.packName ?? null,
        status: input.status,
        wallet_address: input.walletAddress,
        price_cents: input.priceCents ?? null,
        card: input.card ?? null,
        updated_at: now,
      },
      { onConflict: "slabz_transaction_id" },
    )
    .select(
      "id, user_id, slabz_transaction_id, pack_id, pack_name, status, wallet_address, price_cents, card, created_at, updated_at",
    )
    .single();

  if (error) {
    if (isMissingSlabzTableError(error)) return null;
    throw error;
  }
  return data ? rowToRip(data as RipRow) : null;
}
