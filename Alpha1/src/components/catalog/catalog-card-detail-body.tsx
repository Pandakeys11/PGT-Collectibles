"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { CatalogCardMarketIntelPanel } from "@/components/catalog/catalog-card-market-intel-panel";
import type { CatalogRawFmvSeed } from "@/lib/market/fmv-display";
import { cn } from "@/lib/cn";

export type CatalogCardDetailIdentity = {
  catalogId: string;
  name: string;
  /** Primary subtitle: set · number · rarity */
  subtitle?: string | null;
  image?: ReactNode;
  badges?: ReactNode;
  /** Shown in collapsed “More details” */
  extraRows?: Array<{ label: string; value: string | null | undefined }>;
  /** Instant Raw FMV while market intel hydrates (from catalog row prices). */
  initialRawFmv?: CatalogRawFmvSeed | null;
};

function CatalogDetailHero({
  identity,
  hideTitle,
}: {
  identity: CatalogCardDetailIdentity;
  hideTitle?: boolean;
}) {
  return (
    <section className="sc-catalog-detail-hero" aria-label={`${identity.name} card preview`}>
      {identity.image ? (
        <div className="sc-catalog-detail-hero__frame">
          <div className="sc-catalog-detail-hero__art">{identity.image}</div>
          <div className="sc-catalog-detail-hero__shine" aria-hidden />
        </div>
      ) : (
        <div className="sc-catalog-detail-hero__frame sc-catalog-detail-hero__frame--empty">
          <span className="text-xs text-faint">No artwork</span>
        </div>
      )}

      <div className="sc-catalog-detail-hero__meta">
        {!hideTitle ? (
          <h3 className="sc-catalog-detail-hero__name">{identity.name}</h3>
        ) : null}
        {identity.subtitle ? (
          <p className={cn("sc-catalog-detail-hero__subtitle", !hideTitle && "mt-0.5")}>
            {identity.subtitle}
          </p>
        ) : null}
        {identity.badges ? (
          <div className="sc-catalog-detail-hero__badges">{identity.badges}</div>
        ) : null}
      </div>
    </section>
  );
}

function CatalogDetailIdentityRow({
  identity,
  hideTitle,
}: {
  identity: CatalogCardDetailIdentity;
  hideTitle?: boolean;
}) {
  return (
    <div className="sc-catalog-detail-identity">
      {identity.image ? (
        <div className="sc-catalog-detail-identity__media">{identity.image}</div>
      ) : null}
      <div className="sc-catalog-detail-identity__text min-w-0">
        {!hideTitle ? (
          <h3 className="text-sm font-semibold leading-snug text-primary sm:text-[0.9375rem]">
            {identity.name}
          </h3>
        ) : null}
        {identity.subtitle ? (
          <p
            className={cn(
              "text-[11px] leading-snug text-muted",
              hideTitle ? "line-clamp-2" : "mt-0.5 line-clamp-2 sm:line-clamp-1",
            )}
          >
            {identity.subtitle}
          </p>
        ) : null}
        {identity.badges ? (
          <div className="mt-1 flex max-w-full flex-wrap gap-1">{identity.badges}</div>
        ) : null}
      </div>
    </div>
  );
}

export function CatalogCardDetailBody({
  identity,
  actions,
  showMarketIntel = true,
  variant = "sheet",
  /** When the sheet header already shows the card name. */
  hideTitle = false,
}: {
  identity: CatalogCardDetailIdentity;
  actions?: ReactNode;
  showMarketIntel?: boolean;
  /** `sheet` = master catalog popup; `full` = dedicated market page. */
  variant?: "sheet" | "full";
  hideTitle?: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const extraRows = (identity.extraRows ?? []).filter((r) => r.value != null && r.value !== "");
  const isSheet = variant === "sheet";

  return (
    <div
      className={cn(
        "sc-catalog-card-detail min-w-0",
        isSheet && "sc-catalog-card-detail--sheet",
      )}
    >
      {isSheet ? (
        <CatalogDetailHero identity={identity} hideTitle={hideTitle} />
      ) : (
        <CatalogDetailIdentityRow identity={identity} hideTitle={hideTitle} />
      )}

      {showMarketIntel ? (
        <CatalogCardMarketIntelPanel
          catalogId={identity.catalogId}
          variant={isSheet ? "sheet" : "full"}
          autoRefreshWhenThin
          initialRawFmv={identity.initialRawFmv}
        />
      ) : null}

      {extraRows.length > 0 ? (
        <div className="rounded-lg border border-border-subtle/70 bg-panel-raised/20">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[11px] font-medium text-muted touch-manipulation"
            onClick={() => setDetailsOpen((o) => !o)}
            aria-expanded={detailsOpen}
          >
            More card details
            <ChevronDown
              className={cn("h-3.5 w-3.5 shrink-0 transition", detailsOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {detailsOpen ? (
            <dl className="border-t border-border-subtle/60 px-2.5 pb-2 pt-1">
              {extraRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-3 py-1 text-[10px]"
                >
                  <dt className="shrink-0 text-faint">{row.label}</dt>
                  <dd className="min-w-0 text-right font-medium text-primary">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}

      {actions && !isSheet ? (
        <div className="sc-catalog-detail-actions flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Sticky footer actions for catalog detail sheets (desktop + mobile). */
export function CatalogCardDetailActions({ children }: { children: ReactNode }) {
  return (
    <div className="sc-catalog-detail-actions flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}
