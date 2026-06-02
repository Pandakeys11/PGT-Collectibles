"use client";

import { Download, FileImage, FolderUp, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DigitalScanAsset } from "@/lib/digital-scan/types";
import { cn } from "@/lib/cn";

export function DigitalScanResultsStrip({
  assets,
  rendering,
  progress,
  sessionTitle,
  onDownloadZip,
  onSaveToVault,
  onDownloadOne,
  savingVault,
  className,
}: {
  assets: DigitalScanAsset[];
  rendering?: boolean;
  progress?: { done: number; total: number; currentLabel?: string } | null;
  sessionTitle: string;
  onDownloadZip: (includeAttestation?: boolean) => void;
  onSaveToVault?: () => void;
  onDownloadOne: (asset: DigitalScanAsset) => void;
  savingVault?: boolean;
  className?: string;
}) {
  const ready = assets.filter((a) => a.status === "ready" || a.status === "user_adjusted");
  const failed = assets.filter((a) => a.status === "failed");

  if (assets.length === 0 && !rendering) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3 ring-1 ring-violet-400/10",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">
            <FileImage className="h-3.5 w-3.5" aria-hidden />
            Digital Scan output
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {rendering && progress
              ? `Rendering ${progress.done}/${progress.total}${progress.currentLabel ? ` · ${progress.currentLabel}` : ""}…`
              : `${ready.length} scanner-grade file${ready.length === 1 ? "" : "s"} ready`}
            {failed.length > 0 ? ` · ${failed.length} failed` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={rendering || ready.length === 0}
            onClick={() => onDownloadZip(false)}
            className="h-8 gap-1 border-violet-400/25 bg-violet-500/10 text-[11px] text-violet-100 hover:bg-violet-500/20"
          >
            {rendering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            ZIP
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={rendering || ready.length === 0}
            onClick={() => onDownloadZip(true)}
            className="h-8 gap-1 border-violet-400/25 bg-violet-500/10 text-[11px] text-violet-100 hover:bg-violet-500/20"
            title="Includes attestation-pack.json for verified twin / web3 workflows"
          >
            <Package className="h-3.5 w-3.5" />
            Attest ZIP
          </Button>
          {onSaveToVault ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={rendering || ready.length === 0 || savingVault}
              onClick={onSaveToVault}
              className="h-8 gap-1 border-sky-400/25 bg-sky-500/10 text-[11px] text-sky-100 hover:bg-sky-500/20"
            >
              {savingVault ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderUp className="h-3.5 w-3.5" />
              )}
              Scan Vault
            </Button>
          ) : null}
        </div>
      </div>

      {ready.length > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scanner-chat-scrollbar">
          {ready.slice(0, 24).map((asset) => (
            <button
              key={asset.specimenId}
              type="button"
              onClick={() => onDownloadOne(asset)}
              className="group shrink-0 text-left"
              title={`Download ${asset.filename}`}
            >
              <div className="relative h-20 w-14 overflow-hidden rounded-lg border border-white/10 bg-black/40 ring-1 ring-white/5 transition group-hover:ring-violet-400/40">
                {asset.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.dataUrl}
                    alt={asset.sidecar.name}
                    className="h-full w-full object-contain"
                  />
                ) : null}
                <span className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-center font-mono text-[8px] text-violet-100">
                  {String(asset.cardIndexOnPage).padStart(2, "0")}
                </span>
              </div>
              <p className="mt-1 max-w-[3.5rem] truncate text-[9px] text-slate-500">
                {asset.sidecar.name}
              </p>
            </button>
          ))}
        </div>
      ) : null}

      {sessionTitle ? (
        <p className="mt-2 truncate text-[10px] text-slate-600">Session: {sessionTitle}</p>
      ) : null}
    </div>
  );
}
