"use client";

import { SignInButton } from "@clerk/nextjs";
import {
  ExternalLink,
  History,
  Loader2,
  Package,
  RefreshCw,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSlabzTokenAmount, shortSolanaAddress } from "@/lib/slabz/display";
import { SLABZ_BRAND_LOGO_URL } from "@/lib/slabz/pack-art";
import { LIQUID_SCAN_PATH } from "@/lib/app-routes";
import { cn } from "@/lib/cn";

export function SlabzPanelHeader({
  network,
  onRefreshPacks,
  packsLoading,
  onDismiss,
}: {
  network: "devnet" | "mainnet";
  onRefreshPacks: () => void;
  packsLoading: boolean;
  onDismiss?: () => void;
}) {
  return (
    <header className="sc-slabz-rip-panel__header relative shrink-0 overflow-hidden border-b border-cyan-400/20 px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="sc-slabz-rip-panel__header-mesh pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="sc-slabz-logo-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl sm:h-12 sm:w-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SLABZ_BRAND_LOGO_URL} alt="Slabz" className="h-6 w-auto sm:h-7" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-50 sm:text-xs">
              Slabz mystery packs
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 sm:text-[11px]">
              Graded slab rips · {network === "devnet" ? "Devnet · USDC-DEV" : "Mainnet · USDC"}
            </p>
            <p className="mt-1 hidden text-[10px] text-slate-500 sm:block">
              Connect Phantom, rip packs, reveal vaulted PSA slabs — synced to your PGT account.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onRefreshPacks}
            className="sc-slabz-icon-btn flex h-9 w-9 items-center justify-center rounded-xl"
            aria-label="Refresh packs"
          >
            <RefreshCw className={cn("h-4 w-4", packsLoading && "animate-spin")} />
          </button>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="sc-slabz-icon-btn flex h-9 w-9 items-center justify-center rounded-xl"
              aria-label="Close Slabz panel"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function SlabzStatsStrip({
  configured,
  livePacks,
  catalogCards,
  ripCount,
  signedIn,
  catalogSyncing,
  onSyncCatalog,
}: {
  configured: boolean;
  livePacks?: number;
  catalogCards?: number | null;
  ripCount: number;
  signedIn: boolean;
  catalogSyncing: boolean;
  onSyncCatalog: () => void;
}) {
  if (!configured) return null;

  return (
    <div className="sc-slabz-stats-strip mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
      <div className="sc-slabz-stat-pill col-span-2 flex items-center gap-2 sm:col-span-1">
        <span className="sc-slabz-stat-dot h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-wider text-emerald-300/80">API</p>
          <p className="text-[11px] font-semibold text-emerald-100">Connected</p>
        </div>
      </div>
      <div className="sc-slabz-stat-pill flex items-center gap-2">
        <Package className="h-4 w-4 shrink-0 text-cyan-300/80" aria-hidden />
        <div>
          <p className="text-[9px] uppercase tracking-wider text-slate-500">Packs</p>
          <p className="font-mono text-[11px] font-bold text-slate-100">{livePacks ?? "—"}</p>
        </div>
      </div>
      <div className="sc-slabz-stat-pill flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-fuchsia-300/80" aria-hidden />
        <div>
          <p className="text-[9px] uppercase tracking-wider text-slate-500">Slabs</p>
          <p className="font-mono text-[11px] font-bold text-slate-100">{catalogCards ?? "—"}</p>
        </div>
      </div>
      <div className="sc-slabz-stat-pill flex items-center gap-2">
        <History className="h-4 w-4 shrink-0 text-sky-300/80" aria-hidden />
        <div>
          <p className="text-[9px] uppercase tracking-wider text-slate-500">Your rips</p>
          <p className="font-mono text-[11px] font-bold text-slate-100">{ripCount}</p>
        </div>
      </div>
      {signedIn ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={catalogSyncing}
          className="sc-slabz-stat-pill col-span-2 h-auto min-h-[2.75rem] flex-row items-center justify-center gap-1.5 py-2 text-[10px] text-cyan-200 hover:bg-cyan-500/10 sm:col-span-4"
          onClick={onSyncCatalog}
        >
          {catalogSyncing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Syncing catalog…
            </>
          ) : (
            "Sync slabs to master DB"
          )}
        </Button>
      ) : null}
    </div>
  );
}

export function SlabzWalletCard({
  signedIn,
  walletAddress,
  walletLinkedToAccount,
  walletBalance,
  walletBalanceLoading,
  walletConnecting,
  walletError,
  phantomInstalled,
  onConnect,
  onDisconnect,
  onRefreshBalance,
}: {
  signedIn: boolean;
  walletAddress: string | null;
  walletLinkedToAccount: boolean;
  walletBalance: { usdc: number; usdcSymbol: string; sol: number } | null;
  walletBalanceLoading: boolean;
  walletConnecting: boolean;
  walletError: string | null;
  phantomInstalled: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefreshBalance: () => void;
}) {
  if (!signedIn) {
    return (
      <div className="sc-slabz-wallet-card mb-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/50 to-slate-950/80 p-4 text-center sm:p-5">
        <Wallet className="mx-auto h-8 w-8 text-violet-300/70" aria-hidden />
        <p className="mt-3 text-[12px] leading-relaxed text-violet-100/90 sm:text-[13px]">
          Sign in with your PGT account to link Phantom, view balances, and save rip history across
          devices.
        </p>
        <SignInButton mode="modal" fallbackRedirectUrl={LIQUID_SCAN_PATH}>
          <Button
            type="button"
            size="sm"
            className="sc-slabz-rip-cta mt-4 w-full max-w-xs border-violet-400/35 sm:w-auto sm:min-w-[12rem]"
          >
            Sign in to rip
          </Button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div className="sc-slabz-wallet-card mb-3 overflow-hidden rounded-2xl border border-cyan-400/20 ring-1 ring-white/8">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-400/25">
            <Wallet className="h-5 w-5 text-cyan-300" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            {walletAddress ? (
              <>
                <p className="font-mono text-xs font-semibold text-slate-100 sm:text-sm">
                  {shortSolanaAddress(walletAddress, 8, 8)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {walletLinkedToAccount
                    ? "Linked to your PGT account"
                    : "Phantom connected — save to profile"}
                </p>
              </>
            ) : (
              <p className="text-[12px] text-slate-400">
                {phantomInstalled ? "Connect Phantom to rip packs" : "Install Phantom extension"}
              </p>
            )}
          </div>
        </div>

        {walletAddress && walletBalance ? (
          <div className="sc-slabz-balance-block shrink-0 rounded-xl px-3 py-2.5 sm:min-w-[10.5rem] sm:text-right">
            <p className="text-[9px] uppercase tracking-[0.14em] text-cyan-300/70">Balance</p>
            <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-cyan-50 sm:text-lg">
              {formatSlabzTokenAmount(walletBalance.usdc, walletBalance.usdcSymbol)}
            </p>
            <p className="font-mono text-[11px] tabular-nums text-slate-400">
              {walletBalance.sol.toFixed(4)} SOL
            </p>
          </div>
        ) : walletAddress && walletBalanceLoading ? (
          <p className="text-[10px] text-slate-500 sm:shrink-0">Loading balance…</p>
        ) : null}

        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:flex-col sm:items-stretch">
          {walletAddress ? (
            <button
              type="button"
              onClick={onRefreshBalance}
              className="sc-slabz-icon-btn flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[10px] sm:flex-none sm:px-3"
              aria-label="Refresh balance"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", walletBalanceLoading && "animate-spin")} />
              <span className="sm:hidden">Refresh</span>
            </button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={walletConnecting}
            className="sc-slabz-rip-cta h-9 flex-1 text-[11px] sm:min-w-[7.5rem]"
            onClick={onConnect}
          >
            {walletConnecting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Connecting…
              </>
            ) : walletAddress ? (
              "Switch wallet"
            ) : (
              "Connect Phantom"
            )}
          </Button>
          {walletAddress ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={walletConnecting}
              className="h-9 flex-1 text-[10px] text-slate-500 sm:min-w-[5rem]"
              onClick={onDisconnect}
            >
              Unlink
            </Button>
          ) : null}
        </div>
      </div>

      {walletError ? (
        <p className="border-t border-rose-500/20 bg-rose-500/8 px-3 py-2 text-[10px] leading-relaxed text-rose-200/95 sm:px-4">
          {walletError}
        </p>
      ) : null}
      {!phantomInstalled && signedIn ? (
        <p className="border-t border-white/6 px-3 py-2 text-[10px] text-slate-500 sm:px-4">
          <a
            href="https://phantom.app/"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-300 underline"
          >
            Install Phantom
          </a>
          , enable Devnet for testing, then refresh.
        </p>
      ) : null}
    </div>
  );
}

export function SlabzPanelFooter({ docsUrl }: { docsUrl: string }) {
  return (
    <footer className="sc-slabz-panel-footer flex shrink-0 items-center justify-between gap-2 border-t border-cyan-500/15 px-3 py-2.5 sm:px-4">
      <p className="text-[9px] text-slate-600">Powered by Slabz Partner API</p>
      <a
        href={docsUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-[10px] font-medium text-cyan-400/90 hover:text-cyan-300"
      >
        Docs
        <ExternalLink className="h-3 w-3" />
      </a>
    </footer>
  );
}

export function SlabzTabBar({
  tab,
  onTabChange,
  ripCount,
}: {
  tab: "packs" | "history";
  onTabChange: (t: "packs" | "history") => void;
  ripCount: number;
}) {
  return (
    <div className="sc-slabz-tabs sticky top-0 z-10 mb-3 flex gap-1.5 rounded-xl bg-slate-950/90 p-1 ring-1 ring-white/8 backdrop-blur-md">
      <button
        type="button"
        onClick={() => onTabChange("packs")}
        className={cn(
          "sc-slabz-tab flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[11px] font-bold transition sm:py-3 sm:text-xs",
          tab === "packs" ? "sc-slabz-tab--active" : "text-slate-500 hover:text-slate-300",
        )}
      >
        <Package className="h-4 w-4 shrink-0" aria-hidden />
        Packs
      </button>
      <button
        type="button"
        onClick={() => onTabChange("history")}
        className={cn(
          "sc-slabz-tab flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[11px] font-bold transition sm:py-3 sm:text-xs",
          tab === "history" ? "sc-slabz-tab--active" : "text-slate-500 hover:text-slate-300",
        )}
      >
        <History className="h-4 w-4 shrink-0" aria-hidden />
        My rips
        {ripCount > 0 ? (
          <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200 ring-1 ring-cyan-400/30">
            {ripCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
