"use client";

import { SignInButton } from "@clerk/nextjs";
import { BookMarked, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

function BinderTrackerToggle({
  checked,
  disabled,
  onChange,
  id,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  id: string;
  label: string;
}) {
  return (
    <input
      id={id}
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-black/40 accent-emerald-500 disabled:opacity-50"
      aria-label={label}
    />
  );
}

export function CatalogBinderTrackerBar({
  progressLabel,
  trackerEnabled,
  loading,
  saving,
  error,
  isSignedIn,
  isLoaded,
  email,
  onTrackerEnabledChange,
  className,
}: {
  progressLabel: string;
  trackerEnabled: boolean;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  isSignedIn: boolean;
  isLoaded: boolean;
  email?: string | null;
  onTrackerEnabledChange: (enabled: boolean) => void;
  className?: string;
}) {
  const busy = loading || saving;

  return (
    <div
      className={cn(
        "sc-binder-tracker-bar rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-2.5 py-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <BookMarked className="h-4 w-4 shrink-0 text-emerald-300/90" aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100/95">
              Set tracker
            </p>
            <p className="text-[10px] text-muted">
              {trackerEnabled
                ? `${progressLabel} · unchecked cards are black & white`
                : "Mark cards you own — missing cards stay grayscale"}
              {trackerEnabled && email ? (
                <span className="text-faint"> · {email}</span>
              ) : null}
            </p>
          </div>
          {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-300/80" /> : null}
        </div>

        <label
          htmlFor="binder-tracker-enabled"
          className="flex cursor-pointer items-center gap-2 touch-manipulation"
        >
          <span className="text-[10px] font-medium text-slate-300">Track collection</span>
          <BinderTrackerToggle
            id="binder-tracker-enabled"
            label="Toggle set tracker"
            checked={trackerEnabled}
            disabled={!isLoaded}
            onChange={(checked) => {
              if (checked && !isSignedIn) return;
              onTrackerEnabledChange(checked);
            }}
          />
        </label>
      </div>

      {!isLoaded ? null : !isSignedIn && !trackerEnabled ? (
        <p className="mt-1.5 text-[10px] text-muted">
          <SignInButton mode="modal">
            <button type="button" className="font-medium text-amber-300/95 underline-offset-2 hover:underline">
              Sign in
            </button>
          </SignInButton>{" "}
          to save your binder progress across devices.
        </p>
      ) : null}

      {error ? <p className="mt-1.5 text-[10px] text-danger">{error}</p> : null}
    </div>
  );
}
