"use client";

import Link from "next/link";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildScannerPrefillUrl, type CatalogScanPrefill } from "@/lib/scan/catalog-bridge";

export function ScanThisCardButton({
  prefill,
  className,
  targetPath,
}: {
  prefill: CatalogScanPrefill;
  className?: string;
  targetPath?: string;
}) {
  return (
    <Button variant="primary" size="sm" className={className} asChild>
      <Link href={buildScannerPrefillUrl(prefill, targetPath)} className="touch-manipulation">
        <ScanLine className="mr-1.5 h-4 w-4" aria-hidden />
        Scan this card
      </Link>
    </Button>
  );
}
