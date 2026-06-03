"use client";

import { useCallback, useState } from "react";
import { ExternalLink, Gamepad2, Loader2, Wallet, X } from "lucide-react";
import { PGT_ARCADE_IFRAME_ALLOW, PGT_ARCADE_PARTNER, PGT_ARCADE_URL } from "@/lib/partners/pgt-arcade";
import { cn } from "@/lib/cn";

export function PgtArcadePartnerPanel({
  onDismiss,
  className,
}: {
  onDismiss?: () => void;
  className?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const handleLoad = useCallback(() => {
    setLoading(false);
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <div className={cn("sc-pgt-arcade-panel flex min-h-0 w-full min-w-0 flex-col", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Gamepad2 className="h-4 w-4 shrink-0 text-indigo-300" aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-200/90">
              {PGT_ARCADE_PARTNER.label}
            </p>
            <p className="truncate text-[10px] text-slate-500">Embedded on PGTools · wallet sign-in</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={reload}
            className="hidden rounded-lg px-2 py-1 text-[10px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-indigo-200 sm:inline"
          >
            Reload
          </button>
          <a
            href={PGT_ARCADE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-indigo-200"
            title="Open arcade full screen on PGTools"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Full screen</span>
          </a>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5"
              aria-label="Close PGT Arcade"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-white/6 bg-black/25 px-3 py-1.5">
        <Wallet className="h-3 w-3 shrink-0 text-amber-300/90" aria-hidden />
        <p className="text-[10px] leading-snug text-slate-500">
          Connect your wallet inside the arcade below to unlock games and saves.
        </p>
      </div>

      <div className="sc-pgt-arcade-panel__body min-h-0 flex-1 px-3 py-3 sm:px-4">
        <div className="sc-pgt-arcade-embed overflow-hidden rounded-xl border border-indigo-500/25 bg-black shadow-[0_12px_40px_rgb(0_0_0/0.45)]">
          <div className="sc-pgt-arcade-embed__stage relative w-full bg-black">
            <iframe
              key={reloadKey}
              src={PGT_ARCADE_URL}
              title={`${PGT_ARCADE_PARTNER.label} on PGTools`}
              className="sc-pgt-arcade-embed__frame"
              allow={PGT_ARCADE_IFRAME_ALLOW}
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={handleLoad}
            />
            {loading ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-300" aria-hidden />
                <p className="text-[11px] text-slate-400">Loading PGT Arcade…</p>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 bg-gradient-to-r from-indigo-950/50 via-black/60 to-violet-950/30 px-3 py-2">
            <p className="text-[10px] text-slate-500">
              Partner hub ·{" "}
              <span className="font-mono text-slate-600">pgtools.tech/app/arcade</span>
            </p>
            <a
              href={PGT_ARCADE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-200/90 transition hover:text-indigo-100"
            >
              Open full screen
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-600">
          If the embed stays blank, PGTools may need to allow framing — use{" "}
          <span className="text-slate-500">Full screen</span> above.
        </p>
      </div>
    </div>
  );
}
