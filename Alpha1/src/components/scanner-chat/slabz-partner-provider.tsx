"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { slabzPackMediaProxyUrl } from "@/lib/slabz/pack-art";
import type {
  SlabzPack,
  SlabzPartnerPayload,
  SlabzPacksPayload,
  SlabzRipRecord,
  SlabzWalletBalanceSnapshot,
} from "@/lib/slabz/types";
import {
  connectPhantomWallet,
  disconnectPhantomWallet,
  isPhantomInstalled,
  readLocalSlabzWallet,
  subscribePhantomAccountChange,
  tryEagerPhantomConnect,
  writeLocalSlabzWallet,
} from "@/lib/slabz/wallet-client";

export type SlabzRipPhase =
  | "idle"
  | "purchase"
  | "sign"
  | "submit"
  | "open"
  | "reveal"
  | "error";

export type SlabzActiveRip = {
  pack: SlabzPack;
  transactionId: string;
  priceCents: number;
  phase: SlabzRipPhase;
  statusMessage: string;
  revealedCard: SlabzRipRecord["card"];
  error: string | null;
};

type SlabzPartnerContextValue = {
  status: SlabzPartnerPayload | null;
  packs: SlabzPack[];
  packsLoading: boolean;
  packsError: string | null;
  walletAddress: string | null;
  walletLinkedToAccount: boolean;
  walletConnecting: boolean;
  walletError: string | null;
  walletBalance: SlabzWalletBalanceSnapshot | null;
  walletBalanceLoading: boolean;
  reloadWalletBalance: () => Promise<void>;
  phantomInstalled: boolean;
  network: "devnet" | "mainnet";
  configured: boolean;
  signedIn: boolean;
  recentRips: SlabzRipRecord[];
  activeRip: SlabzActiveRip | null;
  reloadStatus: () => Promise<void>;
  reloadPacks: () => Promise<void>;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  saveWallet: (address: string) => Promise<void>;
  startRip: (pack: SlabzPack) => Promise<void>;
  resetRip: () => void;
  refreshTransaction: (transactionId: string) => Promise<void>;
  revealStuckRip: (rip: SlabzRipRecord) => Promise<void>;
  syncMasterCatalog: () => Promise<{
    ok: boolean;
    cardsUpserted?: number;
    error?: string;
  }>;
  catalogSyncing: boolean;
  collectionSaving: boolean;
  collectionSaveMessage: string | null;
  saveRipsToCollection: (options?: {
    transactionIds?: string[];
    sessionId?: string;
    title?: string;
  }) => Promise<{ sessionId: string; savedCount: number } | null>;
  clearCollectionSaveMessage: () => void;
};

const SlabzPartnerContext = createContext<SlabzPartnerContextValue | null>(null);

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function SlabzPartnerProvider({ children }: { children: ReactNode }) {
  const { userId, isSignedIn } = useAuth();
  const [status, setStatus] = useState<SlabzPartnerPayload | null>(null);
  const [packs, setPacks] = useState<SlabzPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [packsError, setPacksError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletLinkedToAccount, setWalletLinkedToAccount] = useState(false);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<SlabzWalletBalanceSnapshot | null>(null);
  const [walletBalanceLoading, setWalletBalanceLoading] = useState(false);
  const [phantomInstalled, setPhantomInstalled] = useState(false);
  const [activeRip, setActiveRip] = useState<SlabzActiveRip | null>(null);
  const [catalogSyncing, setCatalogSyncing] = useState(false);
  const [collectionSaving, setCollectionSaving] = useState(false);
  const [collectionSaveMessage, setCollectionSaveMessage] = useState<string | null>(null);
  const ripGen = useRef(0);
  const eagerTriedRef = useRef<string | null>(null);

  const configured = status?.capabilities.configured ?? false;
  const network = status?.capabilities.network ?? "devnet";
  const signedIn = Boolean(isSignedIn && userId);

  const reloadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/partners/slabz/status", { credentials: "same-origin" });
      const body = (await res.json()) as SlabzPartnerPayload;
      setStatus(body);

      const dbWallet = body.profile?.walletAddress ?? null;
      const linked = Boolean(body.profile?.linkedToAccount && dbWallet);

      if (body.signedIn) {
        setWalletAddress(dbWallet);
        setWalletLinkedToAccount(linked);
        if (dbWallet) writeLocalSlabzWallet(dbWallet, userId);
      } else {
        setWalletLinkedToAccount(false);
        setWalletAddress(readLocalSlabzWallet(null));
      }
    } catch (err) {
      console.error("[slabz] status", err);
    }
  }, [userId]);

  const reloadWalletBalance = useCallback(async () => {
    const addr = walletAddress?.trim();
    if (!addr) {
      setWalletBalance(null);
      return;
    }
    setWalletBalanceLoading(true);
    try {
      const res = await fetch(
        `/api/partners/slabz/wallet/balance?address=${encodeURIComponent(addr)}`,
        { credentials: "same-origin" },
      );
      const body = (await res.json()) as {
        balance?: SlabzWalletBalanceSnapshot & { walletAddress?: string };
        error?: string;
      };
      if (res.ok && body.balance) {
        setWalletBalance({
          sol: body.balance.sol,
          usdc: body.balance.usdc,
          usdcSymbol: body.balance.usdcSymbol,
          network: body.balance.network,
        });
      }
    } catch (err) {
      console.warn("[slabz] balance", err);
    } finally {
      setWalletBalanceLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void reloadWalletBalance();
  }, [reloadWalletBalance]);

  const reloadPacks = useCallback(async () => {
    setPacksLoading(true);
    setPacksError(null);
    try {
      const res = await fetch("/api/partners/slabz/packs", { credentials: "same-origin" });
      const body = (await res.json()) as SlabzPacksPayload;
      if (!body.configured) {
        setPacks([]);
        setPacksError(body.error ?? "Slabz partner API is not configured on this server.");
        return;
      }
      setPacks(body.packs ?? []);
      if (body.error) setPacksError(body.error);
    } catch (err) {
      setPacksError(err instanceof Error ? err.message : "Failed to load packs");
    } finally {
      setPacksLoading(false);
    }
  }, []);

  useEffect(() => {
    setPhantomInstalled(isPhantomInstalled());
    void reloadStatus();
    void reloadPacks();
  }, [reloadStatus, reloadPacks, userId]);

  useEffect(() => {
    if (!signedIn || !userId || !status) return;
    if (status.profile?.walletAddress) return;
    if (eagerTriedRef.current === userId) return;
    eagerTriedRef.current = userId;

    void (async () => {
      const eager = await tryEagerPhantomConnect();
      if (!eager) return;
      try {
        const res = await fetch("/api/partners/slabz/wallet", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: eager }),
        });
        if (!res.ok) return;
        writeLocalSlabzWallet(eager, userId);
        setWalletAddress(eager);
        setWalletLinkedToAccount(true);
        setWalletError(null);
        await reloadStatus();
      } catch {
        /* user can connect manually */
      }
    })();
  }, [signedIn, userId, status, reloadStatus]);

  useEffect(() => {
    return subscribePhantomAccountChange((address) => {
      if (!signedIn || !address) return;
      void (async () => {
        try {
          const res = await fetch("/api/partners/slabz/wallet", {
            method: "PUT",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: address }),
          });
          if (!res.ok) return;
          writeLocalSlabzWallet(address, userId);
          setWalletAddress(address);
          setWalletLinkedToAccount(true);
          await reloadStatus();
        } catch {
          /* ignore */
        }
      })();
    });
  }, [signedIn, userId, reloadStatus]);

  const saveWallet = useCallback(
    async (address: string) => {
      const trimmed = address.trim();
      if (!trimmed) throw new Error("Wallet address is empty.");

      if (!signedIn || !userId) {
        writeLocalSlabzWallet(trimmed, null);
        setWalletAddress(trimmed);
        setWalletLinkedToAccount(false);
        throw new Error("Sign in with your PGT account to save this wallet to your profile.");
      }

      const res = await fetch("/api/partners/slabz/wallet", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: trimmed }),
      });
      const body = (await res.json()) as { error?: string; walletAddress?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to link wallet to your account.");
      }

      writeLocalSlabzWallet(trimmed, userId);
      setWalletAddress(body.walletAddress ?? trimmed);
      setWalletLinkedToAccount(true);
      setWalletError(null);
      await reloadStatus();
    },
    [signedIn, userId, reloadStatus],
  );

  const connectWallet = useCallback(async () => {
    if (!signedIn || !userId) {
      const msg = "Sign in with your PGT account first, then connect Phantom.";
      setWalletError(msg);
      throw new Error(msg);
    }

    setWalletConnecting(true);
    setWalletError(null);
    try {
      const address = await connectPhantomWallet({
        forceReconnect: Boolean(walletAddress),
      });
      await saveWallet(address);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not connect Phantom";
      setWalletError(msg);
      throw err;
    } finally {
      setWalletConnecting(false);
    }
  }, [signedIn, userId, walletAddress, saveWallet]);

  const disconnectWallet = useCallback(async () => {
    setWalletError(null);
    setWalletConnecting(true);
    try {
      await disconnectPhantomWallet();
      if (signedIn && userId) {
        const res = await fetch("/api/partners/slabz/wallet", {
          method: "DELETE",
          credentials: "same-origin",
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? "Failed to unlink wallet from your account.");
        }
      }
      setWalletAddress(null);
      setWalletLinkedToAccount(false);
      writeLocalSlabzWallet(null, userId);
      eagerTriedRef.current = null;
      await reloadStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unlink failed";
      setWalletError(msg);
      throw err;
    } finally {
      setWalletConnecting(false);
    }
  }, [signedIn, userId, reloadStatus]);

  const openPackWithRetry = useCallback(
    async (
      transactionId: string,
      wallet: string,
      gen: number,
    ): Promise<SlabzRipRecord["card"]> => {
      for (let attempt = 0; attempt < 12; attempt++) {
        if (gen !== ripGen.current) throw new Error("Cancelled");
        const res = await fetch(`/api/partners/slabz/transactions/${transactionId}/open`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: wallet }),
        });
        const body = (await res.json()) as {
          transaction?: { status?: string; card?: SlabzRipRecord["card"]; retryAfterMs?: number };
          error?: string;
        };

        if (!res.ok && res.status !== 202) {
          throw new Error(body.error ?? "Failed to open pack");
        }

        const tx = body.transaction;
        if (tx?.status === "completed" && tx.card) return tx.card;
        if (tx?.card) return tx.card;

        const delay = tx?.retryAfterMs ?? (res.status === 202 ? 3000 : 2000);
        setActiveRip((prev) =>
          prev
            ? {
                ...prev,
                phase: "open",
                statusMessage: `Minting your graded NFT… (${attempt + 1}/12)`,
              }
            : prev,
        );
        await sleep(delay);
      }
      throw new Error("Pack open timed out — check My rips or refresh status.");
    },
    [],
  );

  const syncMasterCatalog = useCallback(async () => {
    setCatalogSyncing(true);
    try {
      const res = await fetch("/api/partners/slabz/sync?maxTransactions=100", {
        method: "POST",
        credentials: "same-origin",
      });
      const body = (await res.json()) as {
        ok?: boolean;
        cardsUpserted?: number;
        error?: string;
        errors?: string[];
      };
      await reloadStatus();
      if (!res.ok || !body.ok) {
        const msg = body.error ?? body.errors?.[0] ?? "Catalog sync failed";
        return { ok: false, error: msg };
      }
      return { ok: true, cardsUpserted: body.cardsUpserted };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Catalog sync failed" };
    } finally {
      setCatalogSyncing(false);
    }
  }, [reloadStatus]);

  const clearCollectionSaveMessage = useCallback(() => {
    setCollectionSaveMessage(null);
  }, []);

  const saveRipsToCollection = useCallback(
    async (options?: { transactionIds?: string[]; sessionId?: string; title?: string }) => {
      if (!signedIn) {
        setCollectionSaveMessage("Sign in to save slabs to your collection.");
        return null;
      }
      setCollectionSaving(true);
      setCollectionSaveMessage(null);
      try {
        const res = await fetch("/api/partners/slabz/collection", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionIds: options?.transactionIds,
            sessionId: options?.sessionId,
            title: options?.title,
          }),
        });
        const body = (await res.json()) as {
          sessionId?: string;
          savedCount?: number;
          error?: string;
        };
        if (!res.ok) {
          setCollectionSaveMessage(body.error ?? "Save failed");
          return null;
        }
        const savedCount = body.savedCount ?? 0;
        setCollectionSaveMessage(
          `Saved ${savedCount} slab${savedCount === 1 ? "" : "s"} to Recent scans — open the sidebar to view.`,
        );
        return {
          sessionId: body.sessionId!,
          savedCount,
        };
      } catch (err) {
        setCollectionSaveMessage(err instanceof Error ? err.message : "Save failed");
        return null;
      } finally {
        setCollectionSaving(false);
      }
    },
    [signedIn],
  );

  const startRip = useCallback(
    async (pack: SlabzPack) => {
      if (!signedIn) throw new Error("Sign in to rip packs with your PGT account.");
      if (!configured) throw new Error("Slabz partner is not configured on this server.");

      let wallet = walletAddress;
      if (!wallet) {
        setWalletConnecting(true);
        try {
          wallet = await connectPhantomWallet();
          await saveWallet(wallet);
        } finally {
          setWalletConnecting(false);
        }
      }
      if (!walletLinkedToAccount) {
        await saveWallet(wallet);
      }

      const gen = ++ripGen.current;
      const proxyArt = slabzPackMediaProxyUrl(pack);
      if (proxyArt) void fetch(proxyArt, { credentials: "same-origin" }).catch(() => null);

      setActiveRip({
        pack,
        transactionId: "",
        priceCents: pack.priceCents,
        phase: "purchase",
        statusMessage: "Reserving pack on Slabz…",
        revealedCard: null,
        error: null,
      });

      try {
        const purchaseRes = await fetch(
          `/api/partners/slabz/packs/${encodeURIComponent(pack.id)}/purchase`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: wallet, packName: pack.name }),
          },
        );
        const purchaseBody = (await purchaseRes.json()) as {
          transactionId?: string;
          unsignedTransaction?: string;
          priceCents?: number;
          error?: string;
        };
        if (!purchaseRes.ok) {
          throw new Error(purchaseBody.error ?? "Purchase failed");
        }

        const transactionId = purchaseBody.transactionId!;
        const unsigned = purchaseBody.unsignedTransaction!;

        if (gen !== ripGen.current) return;

        setActiveRip((prev) =>
          prev
            ? {
                ...prev,
                transactionId,
                priceCents: purchaseBody.priceCents ?? pack.priceCents,
                phase: "sign",
                statusMessage: "Approve USDC-DEV payment in Phantom (Devnet)…",
              }
            : prev,
        );

        const { signSlabzBase64Transaction } = await import("@/lib/slabz/wallet-client");
        const signedTransaction = await signSlabzBase64Transaction(unsigned);

        if (gen !== ripGen.current) return;

        setActiveRip((prev) =>
          prev
            ? { ...prev, phase: "submit", statusMessage: "Submitting on-chain payment…" }
            : prev,
        );

        const submitRes = await fetch(
          `/api/partners/slabz/transactions/${transactionId}/submit`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signedTransaction }),
          },
        );
        const submitBody = (await submitRes.json()) as { error?: string };
        if (!submitRes.ok) throw new Error(submitBody.error ?? "Submit failed");

        if (gen !== ripGen.current) return;

        setActiveRip((prev) =>
          prev
            ? { ...prev, phase: "open", statusMessage: "Confirming payment on-chain…" }
            : prev,
        );

        for (let poll = 0; poll < 16; poll++) {
          if (gen !== ripGen.current) return;
          const txRes = await fetch(`/api/partners/slabz/transactions/${transactionId}`, {
            credentials: "same-origin",
          });
          const txBody = (await txRes.json()) as { transaction?: { status?: string } };
          const st = txBody.transaction?.status;
          if (st === "confirmed" || st === "completed" || st === "opening") break;
          await sleep(1500);
        }

        setActiveRip((prev) =>
          prev
            ? { ...prev, phase: "open", statusMessage: "Ripping pack — revealing your slab…" }
            : prev,
        );

        const card = await openPackWithRetry(transactionId, wallet, gen);
        if (gen !== ripGen.current) return;

        setActiveRip((prev) =>
          prev
            ? {
                ...prev,
                phase: "reveal",
                statusMessage: "Pack opened!",
                revealedCard: card,
              }
            : prev,
        );
        await reloadStatus();
        void reloadWalletBalance();
        void syncMasterCatalog();
      } catch (err) {
        if (gen !== ripGen.current) return;
        const message = err instanceof Error ? err.message : "Rip failed";
        setActiveRip((prev) =>
          prev ? { ...prev, phase: "error", error: message, statusMessage: message } : prev,
        );
      }
    },
    [
      signedIn,
      configured,
      walletAddress,
      walletLinkedToAccount,
      saveWallet,
      openPackWithRetry,
      reloadStatus,
      reloadWalletBalance,
      syncMasterCatalog,
    ],
  );

  const revealStuckRip = useCallback(
    async (rip: SlabzRipRecord) => {
      const wallet = walletAddress ?? rip.walletAddress;
      if (!wallet) throw new Error("Connect Phantom to reveal this pack.");
      const pack =
        packs.find((p) => p.id === rip.packId) ??
        ({
          id: rip.packId,
          name: rip.packName ?? "Pack",
          priceCents: rip.priceCents ?? 0,
        } as SlabzPack);

      const gen = ++ripGen.current;
      setActiveRip({
        pack,
        transactionId: rip.slabzTransactionId,
        priceCents: rip.priceCents ?? pack.priceCents,
        phase: "open",
        statusMessage: "Revealing your slab…",
        revealedCard: null,
        error: null,
      });

      try {
        const card = await openPackWithRetry(rip.slabzTransactionId, wallet, gen);
        if (gen !== ripGen.current) return;
        setActiveRip((prev) =>
          prev
            ? { ...prev, phase: "reveal", statusMessage: "Pack opened!", revealedCard: card }
            : prev,
        );
        await reloadStatus();
        void reloadWalletBalance();
        void syncMasterCatalog();
      } catch (err) {
        if (gen !== ripGen.current) return;
        const message = err instanceof Error ? err.message : "Reveal failed";
        setActiveRip((prev) =>
          prev ? { ...prev, phase: "error", error: message, statusMessage: message } : prev,
        );
      }
    },
    [walletAddress, packs, openPackWithRetry, reloadStatus, reloadWalletBalance, syncMasterCatalog],
  );

  const resetRip = useCallback(() => {
    ripGen.current++;
    setActiveRip(null);
  }, []);

  const refreshTransaction = useCallback(
    async (transactionId: string) => {
      const res = await fetch(`/api/partners/slabz/transactions/${transactionId}`, {
        credentials: "same-origin",
      });
      const body = (await res.json()) as {
        transaction?: { card?: SlabzRipRecord["card"]; status?: string };
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Refresh failed");
      await reloadStatus();
    },
    [reloadStatus],
  );

  const value = useMemo<SlabzPartnerContextValue>(
    () => ({
      status,
      packs,
      packsLoading,
      packsError,
      walletAddress,
      walletLinkedToAccount,
      walletConnecting,
      walletError,
      walletBalance,
      walletBalanceLoading,
      reloadWalletBalance,
      phantomInstalled,
      network,
      configured,
      signedIn,
      recentRips: status?.recentRips ?? [],
      activeRip,
      reloadStatus,
      reloadPacks,
      connectWallet,
      disconnectWallet,
      saveWallet,
      startRip,
      resetRip,
      refreshTransaction,
      revealStuckRip,
      syncMasterCatalog,
      catalogSyncing,
      collectionSaving,
      collectionSaveMessage,
      saveRipsToCollection,
      clearCollectionSaveMessage,
    }),
    [
      status,
      packs,
      packsLoading,
      packsError,
      walletAddress,
      walletLinkedToAccount,
      walletConnecting,
      walletError,
      walletBalance,
      walletBalanceLoading,
      reloadWalletBalance,
      phantomInstalled,
      network,
      configured,
      signedIn,
      activeRip,
      reloadStatus,
      reloadPacks,
      connectWallet,
      disconnectWallet,
      saveWallet,
      startRip,
      resetRip,
      refreshTransaction,
      revealStuckRip,
      syncMasterCatalog,
      catalogSyncing,
      collectionSaving,
      collectionSaveMessage,
      saveRipsToCollection,
      clearCollectionSaveMessage,
    ],
  );

  return (
    <SlabzPartnerContext.Provider value={value}>{children}</SlabzPartnerContext.Provider>
  );
}

export function useSlabzPartner(): SlabzPartnerContextValue {
  const ctx = useContext(SlabzPartnerContext);
  if (!ctx) throw new Error("useSlabzPartner must be used within SlabzPartnerProvider");
  return ctx;
}
