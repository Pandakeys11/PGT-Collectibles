"use client";

import { Menu, PanelRightOpen } from "lucide-react";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/branding/brand-logo";
import { ScanQuotaChip } from "@/components/billing/scan-quota-chip";
import { ThemeCyclePill } from "@/components/shell/theme-cycle-pill";
import { CatalogHealthPill } from "@/components/scanner-chat/catalog-health-pill";
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
      <div className="flex h-12 min-h-12 items-center gap-1.5 px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:h-14 sm:gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-white/5 hover:text-primary touch-manipulation"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BrandLogo variant="icon-only" href={null} className="h-6 w-auto shrink-0 sm:h-7" showTagline={false} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-primary sm:text-sm">Liquid Scan</p>
            {scanning ? (
              <p className="truncate text-[10px] text-success/90">Scan in progress…</p>
            ) : (
              <p className="truncate text-[10px] text-muted">AI workspace</p>
            )}
          </div>
        </div>
        {showResultsToggle ? (
          <button
            type="button"
            onClick={onResultsClick}
            className="relative flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-2 text-muted transition hover:bg-white/5 hover:text-primary touch-manipulation"
            aria-label="View scan results"
          >
            <PanelRightOpen className="h-5 w-5" />
            {resultsCount != null && resultsCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-success px-1 text-[9px] font-bold text-canvas">
                {resultsCount > 99 ? "99+" : resultsCount}
              </span>
            ) : null}
          </button>
        ) : null}
        <CatalogHealthPill className="shrink-0" />
        <div className="flex shrink-0 items-center gap-1">
          <ThemeCyclePill size="sm" showLabel={false} className="shrink-0" />
          <Show when="signed-in">
            <UserButton
              userProfileUrl="/profile"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 sm:h-9 sm:w-9",
                },
              }}
            />
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal" fallbackRedirectUrl={LIQUID_SCAN_PATH}>
              <Button type="button" variant="secondary" size="sm" className="h-8 shrink-0 px-2.5 text-xs touch-manipulation">
                Sign in
              </Button>
            </SignInButton>
          </Show>
        </div>
      </div>
      <ScanQuotaChip quota={quota ?? null} variant="mobile" />
    </header>
  );
}
