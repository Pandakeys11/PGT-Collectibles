"use client";

import { Menu, PanelRightOpen } from "lucide-react";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/branding/brand-logo";
import { ScanQuotaChip } from "@/components/billing/scan-quota-chip";
import type { AccountQuota } from "@/hooks/use-scan-quota";
import { LIQUID_SCAN_PATH } from "@/lib/app-routes";
import { cn } from "@/lib/cn";

export function ScannerHeader({
  onMenuClick,
  onResultsClick,
  showResultsToggle,
  resultsCount,
  scanning,
  quota,
  className,
}: {
  onMenuClick: () => void;
  onResultsClick: () => void;
  showResultsToggle: boolean;
  resultsCount?: number;
  scanning?: boolean;
  quota?: AccountQuota | null;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sc-mobile-header shrink-0 border-b border-white/6 lg:hidden",
        className,
      )}
    >
      <div className="flex h-12 min-h-12 items-center gap-2 px-3 sm:h-14 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-slate-100 touch-manipulation"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BrandLogo variant="icon-only" href={null} className="h-6 w-auto shrink-0 sm:h-7" showTagline={false} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-100 sm:text-sm">Liquid Scan</p>
            {scanning ? (
              <p className="truncate text-[10px] text-emerald-400/90">Scan in progress…</p>
            ) : (
              <p className="truncate text-[10px] text-slate-500">AI workspace</p>
            )}
          </div>
        </div>
        {showResultsToggle ? (
          <button
            type="button"
            onClick={onResultsClick}
            className="relative flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-2 text-slate-400 transition hover:bg-white/5 hover:text-slate-100 touch-manipulation"
            aria-label="View scan results"
          >
            <PanelRightOpen className="h-5 w-5" />
            {resultsCount != null && resultsCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-[rgb(8,10,14)]">
                {resultsCount > 99 ? "99+" : resultsCount}
              </span>
            ) : null}
          </button>
        ) : null}
        <Show when="signed-in">
          <UserButton
            userProfileUrl="/profile"
            appearance={{
              elements: {
                avatarBox: "h-9 w-9 sm:h-10 sm:w-10",
              },
            }}
          />
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal" fallbackRedirectUrl={LIQUID_SCAN_PATH}>
            <Button type="button" variant="secondary" size="sm" className="h-9 shrink-0 touch-manipulation">
              Sign in
            </Button>
          </SignInButton>
        </Show>
      </div>
      <ScanQuotaChip quota={quota ?? null} variant="mobile" />
    </header>
  );
}
