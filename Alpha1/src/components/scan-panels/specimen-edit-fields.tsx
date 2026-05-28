"use client";

import type { ReactNode } from "react";
import { Crop, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { CERT_NOT_VISIBLE, isCertNotApplicable } from "@/lib/scan/graded-slab";
import type { ExtractedCard } from "@/lib/scan/schemas";
import {
  matchPresetFromPrintStamps,
  PRINT_VERSION_PRESETS,
  printStampsForPreset,
} from "@/lib/scan/print-identity-ui";
import { cn } from "@/lib/cn";

const SHEET_INPUT =
  "h-8 rounded-md border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/35 focus:ring-1 focus:ring-emerald-500/20 sm:h-8 sm:rounded-md sm:px-2 sm:text-[11px]";

const SHEET_SELECT =
  "h-8 w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-100 focus:border-emerald-500/35 focus:outline-none focus:ring-1 focus:ring-emerald-500/20";

function Field({
  label,
  children,
  variant = "default",
}: {
  label: string;
  children: ReactNode;
  variant?: "default" | "sheet";
}) {
  if (variant === "sheet") {
    return (
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <div className="mt-0.5 min-w-0">{children}</div>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-faint">{label}</p>
      <div className="mt-1 min-w-0">{children}</div>
    </div>
  );
}

export function SpecimenEditFields({
  item,
  rowBusy,
  onUpdate,
  onCommitEdit,
  onAdjustCrop,
  onRescan,
  onRemove,
  hideRemove = false,
  variant = "default",
}: {
  item: ScanSpecimen;
  rowBusy: boolean;
  onUpdate: (patch: Partial<ExtractedCard>) => void;
  onCommitEdit: () => void;
  onAdjustCrop: () => void;
  onRescan: () => void;
  onRemove: () => void;
  hideRemove?: boolean;
  /** Compact Liquid Scan sheet styling */
  variant?: "default" | "sheet";
}) {
  const { card } = item;
  const canMedia = Boolean(item.previewUrl);
  const sheet = variant === "sheet";
  const fieldVariant = sheet ? "sheet" : "default";
  const inputClass = sheet ? SHEET_INPUT : "h-11 text-sm";
  const selectClass = sheet ? SHEET_SELECT : "h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition";

  return (
    <div className={cn(sheet ? "space-y-2" : "space-y-3")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn(
            "touch-manipulation",
            sheet && "h-7 gap-1 rounded-md px-2 text-[10px] font-medium",
          )}
          disabled={!canMedia}
          onClick={onAdjustCrop}
        >
          <Crop className={cn(sheet ? "h-3 w-3" : "mr-1.5 h-4 w-4")} aria-hidden />
          Adjust crop
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn(
            "touch-manipulation",
            sheet && "h-7 gap-1 rounded-md px-2 text-[10px] font-medium",
          )}
          disabled={!canMedia || rowBusy}
          onClick={onRescan}
        >
          <RefreshCw
            className={cn(sheet ? "h-3 w-3" : "mr-1.5 h-4 w-4", rowBusy && "animate-spin")}
            aria-hidden
          />
          Resync
        </Button>
        {!hideRemove ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={cn(
              "touch-manipulation text-danger hover:bg-danger/10 hover:text-danger",
              sheet && "h-7 gap-1 rounded-md px-2 text-[10px] font-medium",
            )}
            disabled={rowBusy}
            onClick={onRemove}
          >
            <Trash2 className={cn(sheet ? "h-3 w-3" : "mr-1.5 h-4 w-4")} aria-hidden />
            Remove
          </Button>
        ) : null}
        {rowBusy ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-muted",
              sheet ? "text-[10px]" : "text-xs",
            )}
          >
            <Loader2 className="h-3 w-3 animate-spin text-accent" aria-hidden />
            Updating
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2",
          sheet ? "gap-1.5" : "gap-2.5",
        )}
      >
        <Field label="Franchise" variant={fieldVariant}>
          <select
            value={card.franchise ?? ""}
            onChange={(e) => {
              onUpdate({ franchise: e.target.value || undefined });
              setTimeout(() => onCommitEdit(), 50);
            }}
            className={selectClass}
          >
            <option value="">Auto-Detect</option>
            <option value="pokemon">Pokémon</option>
            <option value="magic">Magic: The Gathering</option>
            <option value="yugioh">Yu-Gi-Oh!</option>
            <option value="onepiece">One Piece</option>
            <option value="lorcana">Disney Lorcana</option>
            <option value="dragonball">Dragon Ball Super</option>
            <option value="sports">Sports</option>
          </select>
        </Field>
        <Field label="Name" variant={fieldVariant}>
          <Input value={card.name} onChange={(e) => onUpdate({ name: e.target.value })} onBlur={onCommitEdit} className={inputClass} />
        </Field>
        <Field label="Printed name" variant={fieldVariant}>
          <Input value={card.printedName ?? ""} onChange={(e) => onUpdate({ printedName: e.target.value })} onBlur={onCommitEdit} className={inputClass} />
        </Field>
        <Field label="Language" variant={fieldVariant}>
          <Input value={card.language ?? ""} onChange={(e) => onUpdate({ language: e.target.value })} onBlur={onCommitEdit} className={inputClass} />
        </Field>
        <Field label="Set" variant={fieldVariant}>
          <Input value={card.set ?? ""} onChange={(e) => onUpdate({ set: e.target.value })} onBlur={onCommitEdit} className={inputClass} />
        </Field>
        <Field label="Card ID" variant={fieldVariant}>
          <Input value={card.number ?? ""} onChange={(e) => onUpdate({ number: e.target.value })} onBlur={onCommitEdit} className={inputClass} />
        </Field>
        <Field label="Year" variant={fieldVariant}>
          <Input value={card.year ?? ""} onChange={(e) => onUpdate({ year: e.target.value })} onBlur={onCommitEdit} className={inputClass} />
        </Field>
        <Field label="Rarity" variant={fieldVariant}>
          <Input value={card.rarity ?? ""} onChange={(e) => onUpdate({ rarity: e.target.value })} onBlur={onCommitEdit} className={inputClass} />
        </Field>
        <Field label="Print run" variant={fieldVariant}>
          <select
            value={matchPresetFromPrintStamps(card.printStamps)}
            onChange={(e) => {
              const presetId = e.target.value;
              const stamps = printStampsForPreset(presetId);
              onUpdate({ printStamps: stamps || undefined });
              setTimeout(() => onCommitEdit(), 50);
            }}
            className={selectClass}
          >
            {PRINT_VERSION_PRESETS.map((p) => (
              <option key={p.id || "auto"} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Version detail" variant={fieldVariant}>
          <Input
            value={card.printStamps ?? ""}
            onChange={(e) => onUpdate({ printStamps: e.target.value })}
            onBlur={onCommitEdit}
            className={inputClass}
            placeholder="1st Edition · Holo"
          />
        </Field>
        <Field label="Slab label" variant={fieldVariant}>
          <Input
            value={card.labelTitle ?? ""}
            onChange={(e) => onUpdate({ labelTitle: e.target.value || undefined })}
            onBlur={onCommitEdit}
            className={inputClass}
            placeholder="Holder text"
          />
        </Field>
        <Field label="Grader" variant={fieldVariant}>
          <Input value={card.grader ?? ""} onChange={(e) => onUpdate({ grader: e.target.value })} onBlur={onCommitEdit} className={inputClass} placeholder="PSA" />
        </Field>
        <Field label="Grade" variant={fieldVariant}>
          <Input value={card.grade ?? ""} onChange={(e) => onUpdate({ grade: e.target.value })} onBlur={onCommitEdit} className={inputClass} />
        </Field>
        <Field label="Cert" variant={fieldVariant}>
          <Input
            value={isCertNotApplicable(card.cert) ? CERT_NOT_VISIBLE : (card.cert ?? "")}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onUpdate({
                cert:
                  raw === "" || raw.toUpperCase() === CERT_NOT_VISIBLE
                    ? CERT_NOT_VISIBLE
                    : raw.replace(/\D/g, "").length >= 6
                      ? raw.replace(/\D/g, "")
                      : raw,
              });
            }}
            onBlur={onCommitEdit}
            className={cn(inputClass, "font-mono tabular-nums")}
            placeholder="NA"
          />
          {isCertNotApplicable(card.cert) && !sheet ? (
            <p className="mt-1 text-[10px] text-muted">
              Not visible in this photo (common for CGC). Type the cert # from the back of the slab.
            </p>
          ) : null}
        </Field>
        <Field label="Sticker $" variant={fieldVariant}>
          <Input
            type="number"
            inputMode="decimal"
            value={card.extractedPrice ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onUpdate({ extractedPrice: raw === "" ? null : Number(raw) });
            }}
            onBlur={onCommitEdit}
            className={cn(inputClass, "font-mono tabular-nums")}
            placeholder="Tag price"
          />
        </Field>
        <Field label="Sticker note" variant={fieldVariant}>
          <Input
            value={card.stickerNote ?? ""}
            onChange={(e) => onUpdate({ stickerNote: e.target.value || null })}
            onBlur={onCommitEdit}
            className={inputClass}
            placeholder="BIN, OBO"
          />
        </Field>
        <div className="min-w-0 sm:col-span-2">
          <p
            className={cn(
              "font-medium uppercase tracking-wide text-faint",
              sheet ? "text-[9px] font-semibold text-slate-500" : "text-[10px]",
            )}
          >
            Details
          </p>
          <Textarea
            value={card.details ?? ""}
            onChange={(e) => onUpdate({ details: e.target.value })}
            onBlur={onCommitEdit}
            className={cn(
              sheet
                ? "mt-0.5 min-h-[2.75rem] rounded-md border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-slate-100"
                : "mt-1 min-h-[5rem] text-sm",
            )}
          />
        </div>
      </div>
    </div>
  );
}
