import "server-only";

import { auth } from "@clerk/nextjs/server";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import {
  getSlabzApiBaseUrl,
  getSlabzDocsUrl,
  getSlabzNetwork,
  isSlabzPartnerConfigured,
} from "@/lib/slabz/config";
import { slabzPartnerFetch, slabzPartnerFetchEnvelope, SlabzApiError } from "@/lib/slabz/client";
import { fetchSlabzWalletBalance, type SlabzWalletBalance } from "@/lib/slabz/wallet-balance";
import {
  clearSlabzWalletForUser,
  getSlabzWalletForUser,
  listSlabzRipsForUser,
  patchSlabzRipStatus,
  saveSlabzWalletForUser,
  upsertSlabzRip,
} from "@/lib/slabz/repository";
import {
  appendSessionSpecimens,
  persistSessionSpecimens,
  type SessionSpecimenInput,
} from "@/lib/saved/persist-scan-session";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { buildSlabzRipSpecimen } from "@/lib/slabz/slab-to-specimen";
import {
  countSlabzCatalogAssets,
  syncSlabzPacksToMasterCatalog,
  syncSlabzTransactionToCatalog,
} from "@/lib/slabz/sync-master-catalog";
import { normalizeSlabzPack } from "@/lib/slabz/pack-art";
import { fetchSlabzSitePackCatalog, hydratePackFromSiteCatalog } from "@/lib/slabz/site-pack-catalog";
import type {
  SlabzBuybackQuote,
  SlabzPack,
  SlabzPartnerPayload,
  SlabzPacksPayload,
  SlabzTransaction,
} from "@/lib/slabz/types";

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function capabilities() {
  return {
    configured: isSlabzPartnerConfigured(),
    network: getSlabzNetwork(),
    apiBaseUrl: getSlabzApiBaseUrl(),
    docsUrl: getSlabzDocsUrl(),
  };
}

async function resolveSignedInUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { signedIn: false as const, appUser: null };
  const appUser = await syncCurrentAppUser();
  if (!appUser) return { signedIn: false as const, appUser: null };
  return { signedIn: true as const, appUser };
}

export function validateSolanaWalletAddress(walletAddress: string): boolean {
  return SOLANA_ADDRESS_RE.test(walletAddress.trim());
}

async function fetchSlabzTransactionsForWallet(
  walletAddress: string,
  max = 40,
): Promise<SlabzTransaction[]> {
  const trimmed = walletAddress.trim();
  const out: SlabzTransaction[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore && out.length < max) {
    const qs = new URLSearchParams({ limit: String(Math.min(25, max - out.length)) });
    if (cursor) qs.set("cursor", cursor);
    const { body } = await slabzPartnerFetchEnvelope(`/transactions?${qs}`);
    const chunk = Array.isArray(body.data)
      ? (body.data as SlabzTransaction[])
      : [];
    for (const tx of chunk) {
      if (tx.walletAddress?.trim() === trimmed) out.push(tx);
    }
    cursor = typeof body.cursor === "string" ? body.cursor : undefined;
    hasMore = Boolean(body.hasMore);
    if (!chunk.length) break;
  }

  return out.slice(0, max);
}

async function syncWalletRipsFromSlabzApi(
  appUserId: string,
  walletAddress: string,
): Promise<void> {
  if (!isSlabzPartnerConfigured()) return;

  let packById = new Map<string, SlabzPack>();
  try {
    const packsPayload = await fetchSlabzPacks();
    packById = new Map(packsPayload.packs.map((p) => [p.id, p]));
  } catch {
    /* ignore */
  }

  const transactions = await fetchSlabzTransactionsForWallet(walletAddress, 40);
  for (const tx of transactions) {
    if (!tx.packId || !tx.transactionId) continue;
    const pack = packById.get(tx.packId);
    await upsertSlabzRip(appUserId, {
      slabzTransactionId: tx.transactionId,
      packId: tx.packId,
      packName: pack?.name ?? null,
      status: tx.status,
      walletAddress: tx.walletAddress ?? walletAddress,
      priceCents: tx.priceCents ?? pack?.priceCents ?? null,
      card: tx.card ?? null,
    });
    if (tx.status === "completed" && tx.card) {
      try {
        await syncSlabzTransactionToCatalog(tx, pack ?? null);
      } catch (err) {
        console.warn("[slabz] catalog sync wallet rip", err);
      }
    }
  }
}

export async function getSlabzWalletBalanceForAddress(
  walletAddress: string,
): Promise<SlabzWalletBalance | null> {
  if (!validateSolanaWalletAddress(walletAddress)) return null;
  try {
    return await fetchSlabzWalletBalance(walletAddress);
  } catch (err) {
    console.warn("[slabz] wallet balance", err);
    return null;
  }
}

async function loadSlabzCatalogMeta(): Promise<{
  catalogStats: SlabzPartnerPayload["catalogStats"];
  livePackCount?: number;
}> {
  const catalogStats = await countSlabzCatalogAssets();
  let livePackCount: number | undefined;
  if (isSlabzPartnerConfigured()) {
    try {
      const packs = await fetchSlabzPacks();
      if (packs.configured) livePackCount = packs.packs.length;
    } catch {
      /* ignore */
    }
  }
  return { catalogStats, livePackCount };
}

export async function getSlabzPartnerPayload(): Promise<SlabzPartnerPayload> {
  const caps = capabilities();
  const { catalogStats, livePackCount } = await loadSlabzCatalogMeta();
  const { signedIn, appUser } = await resolveSignedInUser();

  if (!signedIn || !appUser) {
    return {
      capabilities: caps,
      signedIn: false,
      profile: null,
      recentRips: [],
      catalogStats,
      livePackCount,
    };
  }

  try {
    const wallet = await getSlabzWalletForUser(appUser.id);
    if (wallet?.walletAddress) {
      try {
        await syncWalletRipsFromSlabzApi(appUser.id, wallet.walletAddress);
      } catch (err) {
        console.warn("[slabz] sync wallet rips", err);
      }
    }
    const recentRips = await listSlabzRipsForUser(appUser.id);
    return {
      capabilities: caps,
      signedIn: true,
      profile: wallet
        ? {
            walletAddress: wallet.walletAddress,
            network: wallet.network,
            storage: "database",
            linkedToAccount: true,
          }
        : {
            walletAddress: null,
            network: caps.network,
            storage: "database",
            linkedToAccount: false,
          },
      recentRips,
      catalogStats,
      livePackCount,
    };
  } catch (err) {
    console.error("[slabz] getSlabzPartnerPayload", err);
    return {
      capabilities: caps,
      signedIn: true,
      profile: { walletAddress: null, network: caps.network, storage: "database" },
      recentRips: [],
      catalogStats,
      livePackCount,
      error: err instanceof Error ? err.message : "Failed to load Slabz profile",
    };
  }
}

export async function saveSlabzWallet(walletAddress: string): Promise<
  | { ok: true; walletAddress: string; network: "devnet" | "mainnet" }
  | { ok: false; error: string; status: number }
> {
  const trimmed = walletAddress.trim();
  if (!validateSolanaWalletAddress(trimmed)) {
    return { ok: false, error: "Invalid Solana wallet address", status: 400 };
  }

  const { signedIn, appUser } = await resolveSignedInUser();
  if (!signedIn || !appUser) {
    return { ok: false, error: "Sign in to link a wallet", status: 401 };
  }

  const network = getSlabzNetwork();
  try {
    await saveSlabzWalletForUser(appUser.id, trimmed, network);
  } catch (err) {
    console.error("[slabz] saveSlabzWalletForUser", err);
    return {
      ok: false,
      error: "Could not save wallet — ensure you are signed in and the database migration is applied.",
      status: 500,
    };
  }
  return { ok: true, walletAddress: trimmed, network };
}

export async function clearSlabzWalletForCurrentUser(): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number }
> {
  const { signedIn, appUser } = await resolveSignedInUser();
  if (!signedIn || !appUser) {
    return { ok: false, error: "Sign in to unlink a wallet", status: 401 };
  }
  try {
    await clearSlabzWalletForUser(appUser.id);
    return { ok: true };
  } catch (err) {
    console.error("[slabz] clearSlabzWalletForUser", err);
    return { ok: false, error: "Failed to unlink wallet", status: 500 };
  }
}

export async function fetchSlabzPacks(): Promise<SlabzPacksPayload> {
  if (!isSlabzPartnerConfigured()) {
    return { configured: false, packs: [], error: "Slabz partner API is not configured" };
  }
  try {
    const { data } = await slabzPartnerFetch<{ packs?: SlabzPack[] } | SlabzPack[]>(
      "/packs",
    );
    const raw = Array.isArray(data) ? data : (data.packs ?? []);
    let packs = raw.map((p) =>
      normalizeSlabzPack(p as unknown as Record<string, unknown>),
    );
    try {
      const siteCatalog = await fetchSlabzSitePackCatalog();
      packs = packs.map((p) => hydratePackFromSiteCatalog(p, siteCatalog));
    } catch (err) {
      console.warn("[slabz] hydrate packs from site catalog", err);
    }
    try {
      await syncSlabzPacksToMasterCatalog(packs);
    } catch (err) {
      console.warn("[slabz] sync packs to master catalog", err);
    }
    return { configured: true, packs };
  } catch (err) {
    const message =
      err instanceof SlabzApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Failed to load packs";
    return { configured: true, packs: [], error: message };
  }
}

export async function fetchSlabzPack(packId: string): Promise<SlabzPack | null> {
  const { data } = await slabzPartnerFetch<{ pack?: SlabzPack } | SlabzPack>(
    `/packs/${encodeURIComponent(packId)}`,
  );
  if (data && typeof data === "object" && "id" in data) {
    return normalizeSlabzPack(data as unknown as Record<string, unknown>);
  }
  const pack = (data as { pack?: SlabzPack }).pack;
  return pack ? normalizeSlabzPack(pack as unknown as Record<string, unknown>) : null;
}

export async function purchaseSlabzPack(
  packId: string,
  walletAddress: string,
  packName?: string | null,
): Promise<
  | {
      ok: true;
      transactionId: string;
      unsignedTransaction: string;
      priceCents: number;
    }
  | { ok: false; error: string; status: number }
> {
  if (!validateSolanaWalletAddress(walletAddress)) {
    return { ok: false, error: "Invalid Solana wallet address", status: 400 };
  }

  const { signedIn, appUser } = await resolveSignedInUser();
  if (!signedIn || !appUser) {
    return { ok: false, error: "Sign in to rip a pack", status: 401 };
  }

  try {
    const { data } = await slabzPartnerFetch<{
      transactionId: string;
      transaction: string;
      priceCents: number;
    }>(`/packs/${encodeURIComponent(packId)}/purchase`, {
      method: "POST",
      body: JSON.stringify({ walletAddress: walletAddress.trim() }),
    });

    await saveSlabzWalletForUser(appUser.id, walletAddress.trim(), getSlabzNetwork());
    await upsertSlabzRip(appUser.id, {
      slabzTransactionId: data.transactionId,
      packId,
      packName: packName ?? null,
      status: "created",
      walletAddress: walletAddress.trim(),
      priceCents: data.priceCents,
    });

    return {
      ok: true,
      transactionId: data.transactionId,
      unsignedTransaction: data.transaction,
      priceCents: data.priceCents,
    };
  } catch (err) {
    const message = err instanceof SlabzApiError ? err.message : "Purchase failed";
    const status = err instanceof SlabzApiError ? err.status : 502;
    return { ok: false, error: message, status };
  }
}

export async function submitSlabzTransaction(
  transactionId: string,
  signedTransaction: string,
): Promise<
  | { ok: true; status: string; signature?: string }
  | { ok: false; error: string; status: number }
> {
  const { signedIn, appUser } = await resolveSignedInUser();
  if (!signedIn || !appUser) {
    return { ok: false, error: "Sign in required", status: 401 };
  }

  try {
    const { data } = await slabzPartnerFetch<{
      transactionId: string;
      status: string;
      signature?: string;
    }>(`/transactions/${encodeURIComponent(transactionId)}/submit`, {
      method: "POST",
      body: JSON.stringify({ signedTransaction }),
    });

    await patchSlabzRipStatus(appUser.id, transactionId, data.status);

    return { ok: true, status: data.status, signature: data.signature };
  } catch (err) {
    const message = err instanceof SlabzApiError ? err.message : "Submit failed";
    const status = err instanceof SlabzApiError ? err.status : 502;
    return { ok: false, error: message, status };
  }
}

export async function openSlabzPack(
  transactionId: string,
  walletAddress: string,
): Promise<
  | { ok: true; transaction: SlabzTransaction; pending: boolean }
  | { ok: false; error: string; status: number }
> {
  const { signedIn, appUser } = await resolveSignedInUser();
  if (!signedIn || !appUser) {
    return { ok: false, error: "Sign in required", status: 401 };
  }

  const trimmedWallet = walletAddress.trim();
  if (!validateSolanaWalletAddress(trimmedWallet)) {
    return { ok: false, error: "Invalid Solana wallet address", status: 400 };
  }

  try {
    const { data, status } = await slabzPartnerFetch<SlabzTransaction>(
      `/transactions/${encodeURIComponent(transactionId)}/open`,
      {
        method: "POST",
        body: JSON.stringify({ walletAddress: trimmedWallet }),
      },
    );

    const pending = status === 202 || data.status === "opening";

    if (data.packId) {
      const pack = await fetchSlabzPack(data.packId);
      await upsertSlabzRip(appUser.id, {
        slabzTransactionId: transactionId,
        packId: data.packId,
        packName: pack?.name ?? null,
        status: data.status,
        walletAddress: data.walletAddress ?? trimmedWallet,
        priceCents: data.priceCents ?? pack?.priceCents ?? null,
        card: data.card ?? null,
      });
    }

    if (data.status === "completed" && data.card) {
      try {
        const pack = data.packId ? await fetchSlabzPack(data.packId) : null;
        await syncSlabzTransactionToCatalog(data, pack);
      } catch (err) {
        console.warn("[slabz] catalog upsert after open", err);
      }
    }

    return { ok: true, transaction: data, pending };
  } catch (err) {
    const message = err instanceof SlabzApiError ? err.message : "Open failed";
    const status = err instanceof SlabzApiError ? err.status : 502;
    return { ok: false, error: message, status };
  }
}

export async function getSlabzTransaction(
  transactionId: string,
): Promise<SlabzTransaction | null> {
  const { data } = await slabzPartnerFetch<SlabzTransaction>(
    `/transactions/${encodeURIComponent(transactionId)}`,
  );
  return data;
}

export async function syncSlabzTransaction(
  transactionId: string,
): Promise<SlabzTransaction | null> {
  const { signedIn, appUser } = await resolveSignedInUser();
  if (!signedIn || !appUser) return null;

  const tx = await getSlabzTransaction(transactionId);
  if (!tx) return null;

  if (tx.packId && tx.walletAddress) {
    await upsertSlabzRip(appUser.id, {
      slabzTransactionId: transactionId,
      packId: tx.packId,
      status: tx.status,
      walletAddress: tx.walletAddress,
      priceCents: tx.priceCents ?? null,
      card: tx.card ?? null,
    });
  }

  if (tx.status === "completed" && tx.card) {
    try {
      const pack = tx.packId ? await fetchSlabzPack(tx.packId) : null;
      await syncSlabzTransactionToCatalog(tx, pack);
    } catch (err) {
      console.warn("[slabz] catalog upsert on sync", err);
    }
  }

  return tx;
}

export async function saveSlabzRipsToUserCollection(options?: {
  transactionIds?: string[];
  sessionId?: string | null;
  title?: string | null;
}): Promise<
  | { ok: true; sessionId: string; savedCount: number; specimenCount: number }
  | { ok: false; error: string; status: number }
> {
  const { signedIn, appUser } = await resolveSignedInUser();
  if (!signedIn || !appUser) {
    return { ok: false, error: "Sign in to save slabs to your collection", status: 401 };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured", status: 503 };
  }

  const rips = await listSlabzRipsForUser(appUser.id, 80);
  const idFilter = options?.transactionIds?.length
    ? new Set(options.transactionIds.map((id) => id.trim()).filter(Boolean))
    : null;

  const eligible = rips.filter(
    (rip) =>
      rip.status === "completed" &&
      rip.card &&
      (!idFilter || idFilter.has(rip.slabzTransactionId)),
  );

  if (eligible.length === 0) {
    return {
      ok: false,
      error: "No completed rips with revealed slabs to save",
      status: 400,
    };
  }

  let packById = new Map<string, SlabzPack>();
  try {
    const packsPayload = await fetchSlabzPacks();
    packById = new Map(packsPayload.packs.map((p) => [p.id, p]));
  } catch {
    /* optional */
  }

  const specimens: SessionSpecimenInput[] = [];
  for (const rip of eligible) {
    try {
      const built = buildSlabzRipSpecimen(rip, packById.get(rip.packId) ?? null);
      specimens.push({ card: built.card, context: built.context as Record<string, unknown> });
      if (rip.card) {
        const pack = packById.get(rip.packId) ?? null;
        await syncSlabzTransactionToCatalog(
          {
            transactionId: rip.slabzTransactionId,
            status: "completed",
            packId: rip.packId,
            walletAddress: rip.walletAddress,
            priceCents: rip.priceCents ?? undefined,
            card: rip.card,
          },
          pack,
        );
      }
    } catch (err) {
      console.warn("[slabz] build specimen", rip.slabzTransactionId, err);
    }
  }

  if (specimens.length === 0) {
    return { ok: false, error: "Could not build save payload for rips", status: 500 };
  }

  const supabase = getSupabaseAdmin();
  const defaultTitle =
    options?.title?.trim() ||
    `Slabz vault · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  try {
    const sessionId = options?.sessionId?.trim();
    if (sessionId) {
      const { data: existing, error: findError } = await supabase
        .from("scan_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", appUser.id)
        .maybeSingle();
      if (findError) throw new Error(findError.message);
      if (!existing) {
        return { ok: false, error: "Saved scan session not found", status: 404 };
      }
      const { savedCount, specimenCount } = await appendSessionSpecimens(supabase, {
        userId: appUser.id,
        sessionId,
        specimens,
      });
      return { ok: true, sessionId, savedCount, specimenCount };
    }

    const { data: session, error: sessionError } = await supabase
      .from("scan_sessions")
      .insert({
        user_id: appUser.id,
        title: defaultTitle,
        specimen_count: specimens.length,
      })
      .select("id")
      .single();
    if (sessionError) throw new Error(sessionError.message);

    const newSessionId = (session as { id: string }).id;
    const { savedCount } = await persistSessionSpecimens(supabase, {
      userId: appUser.id,
      sessionId: newSessionId,
      specimens,
    });

    return {
      ok: true,
      sessionId: newSessionId,
      savedCount,
      specimenCount: savedCount,
    };
  } catch (err) {
    console.error("[slabz] saveSlabzRipsToUserCollection", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save to collection failed",
      status: 500,
    };
  }
}

export async function fetchSlabzBuybackQuote(
  transactionId: string,
): Promise<SlabzBuybackQuote | null> {
  const { data } = await slabzPartnerFetch<SlabzBuybackQuote>(
    `/transactions/${encodeURIComponent(transactionId)}/buyback/quote`,
  );
  return data;
}

export async function initiateSlabzBuyback(
  transactionId: string,
  walletAddress: string,
): Promise<
  | { ok: true; unsignedTransaction: string }
  | { ok: false; error: string; status: number }
> {
  if (!validateSolanaWalletAddress(walletAddress)) {
    return { ok: false, error: "Invalid wallet address", status: 400 };
  }

  const { signedIn } = await resolveSignedInUser();
  if (!signedIn) return { ok: false, error: "Sign in required", status: 401 };

  try {
    const { data } = await slabzPartnerFetch<{ transaction: string }>(
      `/transactions/${encodeURIComponent(transactionId)}/buyback`,
      {
        method: "POST",
        body: JSON.stringify({ walletAddress: walletAddress.trim() }),
      },
    );
    return { ok: true, unsignedTransaction: data.transaction };
  } catch (err) {
    const message = err instanceof SlabzApiError ? err.message : "Buyback failed";
    const status = err instanceof SlabzApiError ? err.status : 502;
    return { ok: false, error: message, status };
  }
}

export async function submitSlabzBuyback(
  transactionId: string,
  signedTransaction: string,
): Promise<
  | { ok: true; status: string }
  | { ok: false; error: string; status: number }
> {
  const { signedIn } = await resolveSignedInUser();
  if (!signedIn) return { ok: false, error: "Sign in required", status: 401 };

  try {
    const { data } = await slabzPartnerFetch<{ status: string }>(
      `/transactions/${encodeURIComponent(transactionId)}/buyback/submit`,
      {
        method: "POST",
        body: JSON.stringify({ signedTransaction }),
      },
    );
    return { ok: true, status: data.status };
  } catch (err) {
    const message = err instanceof SlabzApiError ? err.message : "Buyback submit failed";
    const status = err instanceof SlabzApiError ? err.status : 502;
    return { ok: false, error: message, status };
  }
}
