"use client";

import { Crown } from "lucide-react";
import type { SetInsightPriceCard } from "@/lib/catalog/set-insight-payload";
import { cn } from "@/lib/cn";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export function CatalogChaseCardTile({
  card,
  chaseSku,
  onSelect,
  className,
}: {
  card: SetInsightPriceCard;
  chaseSku?: string | null;
  onSelect?: (catalogId: string) => void;
  className?: string;
}) {
  const clickable = Boolean(card.catalogId && onSelect);
  const numberLabel = card.number ? `#${card.number.replace(/^#/, "")}` : null;

  const body = (
    <>
      <div className="sc-catalog-chase-card__art">
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt="" className="sc-catalog-chase-card__img" />
        ) : (
          <div className="sc-catalog-chase-card__placeholder">
            <Crown className="h-5 w-5 text-amber-400/55" aria-hidden />
          </div>
        )}
      </div>

      <div className="sc-catalog-chase-card__copy min-w-0">
        <p className="sc-catalog-chase-card__eyebrow">Chase card</p>
        <p className="sc-catalog-chase-card__name">{card.name}</p>

        <div className="sc-catalog-chase-card__meta">
          {numberLabel ? <span className="sc-catalog-chase-card__number">{numberLabel}</span> : null}
          {card.rarity ? (
            <span className="sc-catalog-chase-card__rarity">{card.rarity}</span>
          ) : null}
          {chaseSku ? (
            <span className="sc-catalog-chase-card__sku" title={chaseSku}>
              {chaseSku}
            </span>
          ) : null}
        </div>

        <div className="sc-catalog-chase-card__price-block">
          <p className="sc-catalog-chase-card__price">{fmtUsd(card.priceUsd)}</p>
          {card.priceLabel ? (
            <p className="sc-catalog-chase-card__source">{card.priceLabel}</p>
          ) : null}
        </div>
      </div>
    </>
  );

  const rootClass = cn(
    "sc-catalog-chase-card sc-catalog-chase-card--featured",
    clickable && "sc-catalog-chase-card--interactive",
    className,
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={() => onSelect!(card.catalogId!)}
        className={rootClass}
        aria-label={`${card.name} chase card, ${fmtUsd(card.priceUsd)}`}
      >
        {body}
      </button>
    );
  }

  return <div className={rootClass}>{body}</div>;
}
