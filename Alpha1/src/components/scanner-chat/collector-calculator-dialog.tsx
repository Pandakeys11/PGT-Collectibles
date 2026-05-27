"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CollectorVendorCalculator } from "@/components/scanner-chat/collector-vendor-calculator";

export function CollectorCalculatorDialog({
  open,
  onOpenChange,
  baseAmount = 0,
  cardCount = 0,
  baseLabel = "Total value",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseAmount?: number;
  cardCount?: number;
  baseLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/10 bg-[rgb(8,10,14)] p-0 sm:max-w-lg">
        <div className="border-b border-white/6 px-4 py-3 text-left">
          <DialogTitle className="text-base text-slate-100">Collector / vendor calculator</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Price lots from FMV with quick buy %, trade bumps, and copy-ready deal lines.
          </DialogDescription>
        </div>
        <div className="px-3 pb-4 pt-1">
          <CollectorVendorCalculator
            baseAmount={baseAmount}
            cardCount={cardCount}
            baseLabel={baseLabel}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
