"use client";

import type { ReactNode } from "react";
import { Crop, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { ExtractedCard } from "@/lib/scan/schemas";
import { cn } from "@/lib/cn";

function Field({ label, children }: { label: string; children: ReactNode }) {
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
}: {
  item: ScanSpecimen;
  rowBusy: boolean;
  onUpdate: (patch: Partial<ExtractedCard>) => void;
  onCommitEdit: () => void;
  onAdjustCrop: () => void;
  onRescan: () => void;
  onRemove: () => void;
}) {
  const { card } = item;
  const canMedia = Boolean(item.previewUrl);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" className="touch-manipulation" disabled={!canMedia} onClick={onAdjustCrop}>
          <Crop className="mr-1.5 h-4 w-4" aria-hidden />
          Adjust crop
        </Button>
        <Button type="button" variant="secondary" size="sm" className="touch-manipulation" disabled={!canMedia || rowBusy} onClick={onRescan}>
          <RefreshCw className={cn("mr-1.5 h-4 w-4", rowBusy && "animate-spin")} aria-hidden />
          Rescan
        </Button>
        <Button type="button" variant="secondary" size="sm" className="touch-manipulation text-danger hover:bg-danger/10 hover:text-danger" disabled={rowBusy} onClick={onRemove}>
          <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
          Remove
        </Button>
        {rowBusy ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" aria-hidden />
            Updating
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field label="Name">
          <Input value={card.name} onChange={(e) => onUpdate({ name: e.target.value })} onBlur={onCommitEdit} className="h-11 text-sm" />
        </Field>
        <Field label="Printed name">
          <Input value={card.printedName ?? ""} onChange={(e) => onUpdate({ printedName: e.target.value })} onBlur={onCommitEdit} className="h-11 text-sm" />
        </Field>
        <Field label="Language">
          <Input value={card.language ?? ""} onChange={(e) => onUpdate({ language: e.target.value })} onBlur={onCommitEdit} className="h-11 text-sm" />
        </Field>
        <Field label="Set">
          <Input value={card.set ?? ""} onChange={(e) => onUpdate({ set: e.target.value })} onBlur={onCommitEdit} className="h-11 text-sm" />
        </Field>
        <Field label="Card ID">
          <Input value={card.number ?? ""} onChange={(e) => onUpdate({ number: e.target.value })} onBlur={onCommitEdit} className="h-11 text-sm" />
        </Field>
        <Field label="Year">
          <Input value={card.year ?? ""} onChange={(e) => onUpdate({ year: e.target.value })} onBlur={onCommitEdit} className="h-11 text-sm" />
        </Field>
        <Field label="Rarity">
          <Input value={card.rarity ?? ""} onChange={(e) => onUpdate({ rarity: e.target.value })} onBlur={onCommitEdit} className="h-11 text-sm" />
        </Field>
        <Field label="Print / stamps">
          <Input value={card.printStamps ?? ""} onChange={(e) => onUpdate({ printStamps: e.target.value })} onBlur={onCommitEdit} className="h-11 text-sm" placeholder="1st Edition; Reverse Holo" />
        </Field>
        <Field label="Grader">
          <Input value={card.grader ?? ""} onChange={(e) => onUpdate({ grader: e.target.value })} onBlur={onCommitEdit} className="h-11 text-sm" />
        </Field>
        <Field label="Grade">
          <Input value={card.grade ?? ""} onChange={(e) => onUpdate({ grade: e.target.value })} onBlur={onCommitEdit} className="h-11 text-sm" />
        </Field>
        <Field label="Cert">
          <Input value={card.cert ?? ""} onChange={(e) => onUpdate({ cert: e.target.value })} onBlur={onCommitEdit} className="h-11 text-sm" />
        </Field>
        <Field label="Sticker / ask ($)">
          <Input
            type="number"
            inputMode="decimal"
            value={card.extractedPrice ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onUpdate({ extractedPrice: raw === "" ? null : Number(raw) });
            }}
            onBlur={onCommitEdit}
            className="h-11 text-sm"
            placeholder="Visible tag price"
          />
        </Field>
        <Field label="Sticker note">
          <Input
            value={card.stickerNote ?? ""}
            onChange={(e) => onUpdate({ stickerNote: e.target.value || null })}
            onBlur={onCommitEdit}
            className="h-11 text-sm"
            placeholder="BIN, OBO, etc."
          />
        </Field>
        <div className="min-w-0 sm:col-span-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-faint">Details</p>
          <Textarea value={card.details ?? ""} onChange={(e) => onUpdate({ details: e.target.value })} onBlur={onCommitEdit} className="mt-1 min-h-[5rem] text-sm" />
        </div>
      </div>
    </div>
  );
}
