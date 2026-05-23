"use client";

import Link from "next/link";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildScannerPrefillUrl, type CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import { cn } from "@/lib/cn";

export function ScanThisCardButton({
  prefill,
  className,
  targetPath,
  onScan,
  compact = false,
}: {
  prefill: CatalogScanPrefill;
  className?: string;
  targetPath?: string;
  /** When set, loads the card in the current workspace without navigation. */
  onScan?: (prefill: CatalogScanPrefill) => void;
  compact?: boolean;
}) {
  if (onScan) {
    return (
      <Button
        type="button"
        variant="primary"
        size="sm"
        className={cn(
          compact && "h-8 gap-1 rounded-md px-2.5 text-[10px] font-semibold",
          className,
        )}
        onClick={() => onScan(prefill)}
      >
        <ScanLine className={cn(compact ? "h-3 w-3" : "mr-1.5 h-4 w-4")} aria-hidden />
        Scan this card
      </Button>
    );
  }

  return (
    <Button variant="primary" size="sm" className={className} asChild>
      <Link href={buildScannerPrefillUrl(prefill, targetPath)} className="touch-manipulation">
        <ScanLine className="mr-1.5 h-4 w-4" aria-hidden />
        Scan this card
      </Link>
    </Button>
  );
}
