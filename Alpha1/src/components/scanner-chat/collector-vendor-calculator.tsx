"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Calculator,
  Copy,
  Check,
  Coins,
  Divide,
  HandCoins,
  Percent,
  RefreshCw,
  Store,
  TrendingDown,
} from "lucide-react";
import {
  applyPercentOfBase,
  buildPercentQuotes,
  COLLECTOR_QUICK_RATES,
  formatCalculatorMoney,
  marginFromBase,
  parseCalculatorAmount,
  roundMoney,
  VENDOR_PERCENT_PRESETS,
} from "@/lib/scanner-chat/collector-calculator";
import { cn } from "@/lib/cn";

export type CollectorVendorCalculatorProps = {
  /** Session FMV or manual starting total */
  baseAmount?: number;
  cardCount?: number;
  /** Label when base comes from scan */
  baseLabel?: string;
  compact?: boolean;
  /** Market intelligence rail — minimal chrome, no tier table */
  rail?: boolean;
  /** Inside chat output panel — no duplicate card border */
  embedded?: boolean;
  className?: string;
};

export function CollectorVendorCalculator({
  baseAmount = 0,
  cardCount = 0,
  baseLabel = "Session FMV",
  compact = false,
  rail = false,
  embedded = false,
  className,
}: CollectorVendorCalculatorProps) {
  const [input, setInput] = useState("");
  const [selectedPercent, setSelectedPercent] = useState(85);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (baseAmount > 0) {
      setInput(String(Math.round(baseAmount * 100) / 100));
    }
  }, [baseAmount]);

  const base = useMemo(() => {
    const parsed = parseCalculatorAmount(input);
    return parsed ?? 0;
  }, [input]);

  const offer = useMemo(
    () => applyPercentOfBase(base, selectedPercent),
    [base, selectedPercent],
  );

  const quotes = useMemo(() => buildPercentQuotes(base), [base]);
  const { spread, marginPct } = useMemo(() => marginFromBase(base, offer), [base, offer]);
  const perCard = cardCount > 0 ? offer / cardCount : null;

  const syncFromFmv = useCallback(() => {
    if (baseAmount > 0) setInput(String(Math.round(baseAmount * 100) / 100));
  }, [baseAmount]);

  const applyOfferAmount = useCallback((amount: number) => {
    if (base <= 0) {
      setInput(String(Math.round(amount * 100) / 100));
      setSelectedPercent(100);
      return;
    }
    const pct = Math.min(100, Math.max(1, Math.round((amount / base) * 1000) / 10));
    setSelectedPercent(pct);
  }, [base]);

  const copyOffer = useCallback(async () => {
    const line = [
      `${baseLabel}: ${formatCalculatorMoney(base)}`,
      `Offer (${selectedPercent}%): ${formatCalculatorMoney(offer)}`,
      cardCount > 0 ? `${cardCount} cards · ${formatCalculatorMoney(perCard ?? 0)}/card` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [selectedPercent, base, baseLabel, cardCount, offer, perCard]);

  const tight = compact || rail || embedded;

  return (
    <div
      className={cn(
        !embedded && !rail && "sc-glow-border rounded-xl sc-glass-raised",
        embedded && "rounded-lg",
        rail && "rounded-none border-0 bg-transparent shadow-none",
        tight ? "p-2" : "p-3",
        className,
      )}
    >
      {!rail && !embedded ? (
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
              <Calculator className="h-4 w-4 text-emerald-300" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                Deal calculator
              </p>
              <p className="text-[10px] text-slate-500">Vendor offers & trade math</p>
            </div>
          </div>
          {baseAmount > 0 ? (
            <button
              type="button"
              onClick={syncFromFmv}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[9px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
              title={`Reset to ${baseLabel}`}
            >
              <RefreshCw className="h-3 w-3" />
              FMV
            </button>
          ) : null}
        </div>
      ) : null}

      {rail && baseAmount > 0 ? (
        <button
          type="button"
          onClick={syncFromFmv}
          className="mb-2 inline-flex items-center gap-1 text-[9px] font-medium text-slate-500 hover:text-slate-300"
        >
          <RefreshCw className="h-3 w-3" />
          Sync {baseLabel}
        </button>
      ) : null}

      <div className={cn(tight ? "space-y-2" : "mt-3 space-y-3")}>
        <div>
          <label className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            {baseLabel}
          </label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="0"
              className={cn(
                "w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-7 pr-3 font-mono text-slate-50 tabular-nums outline-none ring-emerald-500/30 focus:ring-1",
                compact ? "text-lg" : "text-xl",
              )}
              aria-label={baseLabel}
            />
          </div>
          {cardCount > 0 && base > 0 ? (
            <p className="mt-1 text-[10px] text-slate-500">
              {cardCount} cards · {formatCalculatorMoney(base / cardCount)}/card FMV
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            "rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-3",
            compact && "p-2.5",
          )}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-400/90">
            Your offer · {selectedPercent}%
          </p>
          <p
            className={cn(
              "font-semibold tabular-nums text-slate-50",
              rail ? "text-xl" : compact ? "text-2xl" : "text-3xl",
            )}
          >
            {formatCalculatorMoney(offer)}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-amber-400/80" />
              {formatCalculatorMoney(spread)} off FMV
              {marginPct != null ? ` (${marginPct.toFixed(0)}%)` : ""}
            </span>
            {perCard != null ? (
              <span className="inline-flex items-center gap-1">
                <Divide className="h-3 w-3" />
                {formatCalculatorMoney(perCard)}/card
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            <Percent className="h-3 w-3" />
            Quick % of total
          </p>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
            {VENDOR_PERCENT_PRESETS.map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={base <= 0}
                onClick={() => setSelectedPercent(pct)}
                className={cn(
                  "touch-manipulation rounded-lg border py-2 text-center transition active:scale-[0.98]",
                  compact ? "text-[10px]" : "text-xs",
                  selectedPercent === pct
                    ? "border-emerald-400/40 bg-emerald-500/15 font-semibold text-emerald-100"
                    : "border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-slate-200",
                  base <= 0 && "opacity-40",
                )}
              >
                <span className="block font-bold tabular-nums">{pct}%</span>
                <span className="mt-0.5 block font-mono text-[9px] opacity-80">
                  {base > 0 ? formatCalculatorMoney(applyPercentOfBase(base, pct), true) : "—"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Collector tools
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <QuickToolButton
              icon={Banknote}
              label="Cash buy"
              hint={`${COLLECTOR_QUICK_RATES.cashOffer}%`}
              disabled={base <= 0}
              onClick={() => setSelectedPercent(COLLECTOR_QUICK_RATES.cashOffer)}
            />
            <QuickToolButton
              icon={HandCoins}
              label="Trade"
              hint={`${COLLECTOR_QUICK_RATES.tradeValue}%`}
              disabled={base <= 0}
              onClick={() => setSelectedPercent(COLLECTOR_QUICK_RATES.tradeValue)}
            />
            <QuickToolButton
              icon={Store}
              label="Store credit"
              hint={`${COLLECTOR_QUICK_RATES.storeCredit}%`}
              disabled={base <= 0}
              onClick={() => setSelectedPercent(COLLECTOR_QUICK_RATES.storeCredit)}
            />
            <QuickToolButton
              icon={ArrowLeftRight}
              label="Fair trade"
              hint={`${COLLECTOR_QUICK_RATES.fairTrade}%`}
              disabled={base <= 0}
              onClick={() => setSelectedPercent(COLLECTOR_QUICK_RATES.fairTrade)}
            />
            <QuickToolButton
              icon={Coins}
              label="Round $10"
              disabled={offer <= 0}
              onClick={() => applyOfferAmount(roundMoney(offer, 10))}
            />
            <QuickToolButton
              icon={Coins}
              label="Round $25"
              disabled={offer <= 0}
              onClick={() => applyOfferAmount(roundMoney(offer, 25))}
            />
            <QuickToolButton
              icon={HandCoins}
              label="+$50 offer"
              disabled={offer <= 0}
              onClick={() => applyOfferAmount(offer + 50)}
            />
            <QuickToolButton
              icon={TrendingDown}
              label="−$50 offer"
              disabled={offer <= 50}
              onClick={() => applyOfferAmount(Math.max(0, offer - 50))}
            />
            <QuickToolButton
              icon={copied ? Check : Copy}
              label={copied ? "Copied" : "Copy deal"}
              disabled={base <= 0}
              onClick={() => void copyOffer()}
            />
          </div>
        </div>

        {base > 0 && !rail ? (
          <div className="rounded-lg border border-white/6 bg-black/20 p-2">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
              All tiers
            </p>
            <ul className="space-y-1">
              {quotes.map((q) => (
                <li key={q.percent} className="flex items-center justify-between gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setSelectedPercent(q.percent)}
                    className={cn(
                      "font-medium tabular-nums transition",
                      selectedPercent === q.percent ? "text-emerald-300" : "text-slate-500 hover:text-slate-300",
                    )}
                  >
                    {q.percent}%
                  </button>
                  <span className="font-mono tabular-nums text-slate-300">
                    {formatCalculatorMoney(q.amount)}
                  </span>
                  <span className="text-slate-600">−{formatCalculatorMoney(q.spread, true)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QuickToolButton({
  icon: Icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: typeof Banknote;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-start gap-0.5 rounded-lg border border-white/8 bg-white/[0.02] px-2 py-2 text-left transition hover:border-white/14 hover:bg-white/[0.05] disabled:opacity-40 touch-manipulation active:scale-[0.98]"
    >
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span className="text-[10px] font-medium text-slate-200">{label}</span>
      {hint ? <span className="text-[9px] text-slate-600">{hint}</span> : null}
    </button>
  );
}
