"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { parseScannerPrefill } from "@/lib/scan/catalog-bridge";
import type { useScanSession } from "@/hooks/use-scan-session";

export function CatalogPrefillBootstrap({
  session,
  onPrefillComplete,
}: {
  session: ReturnType<typeof useScanSession>;
  onPrefillComplete?: () => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    const prefill = parseScannerPrefill(searchParams);
    if (!prefill) return;

    consumedRef.current = true;
    void session.ingestCatalogPrefill(prefill).finally(() => {
      router.replace("/scanner", { scroll: false });
      onPrefillComplete?.();
    });
  }, [searchParams, session, router, onPrefillComplete]);

  return null;
}
