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
  quota,
  className,
}: {
  onMenuClick: () => void;
  onResultsClick: () => void;
  showResultsToggle: boolean;
  resultsCount?: number;
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
      <div className="sc-mobile-header__bar">
        <button
          type="button"
          onClick={onMenuClick}
          className="sc-mobile-header__icon-btn sc-mobile-header__menu"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="sc-mobile-header__brand">
          <BrandLogo
            variant="icon-only"
            href={null}
            className="sc-mobile-header__logo shrink-0"
            showTagline={false}
          />
          <h1 className="sc-mobile-header__title text-brand-gradient min-w-0">PGT Liquid Scan</h1>
        </div>

        <div className="sc-mobile-header__actions">
          {showResultsToggle ? (
            <button
              type="button"
              onClick={onResultsClick}
              className="sc-mobile-header__icon-btn sc-mobile-header__results relative"
              aria-label="View scan results"
            >
              <PanelRightOpen className="h-5 w-5" />
              {resultsCount != null && resultsCount > 0 ? (
                <span className="sc-mobile-header__badge">
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
                  avatarBox: "sc-mobile-header__avatar h-8 w-8 sm:h-9 sm:w-9",
                },
              }}
            />
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal" fallbackRedirectUrl={LIQUID_SCAN_PATH}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="sc-mobile-header__signin h-8 shrink-0 px-2.5 text-xs touch-manipulation"
              >
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
