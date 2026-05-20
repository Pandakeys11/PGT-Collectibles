"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AccountQuota } from "@/hooks/use-scan-quota";

const TIP_KEY = "pgt_scan_quota_tip_dismissed";

export function ScanQuotaTip({ quota }: { quota: AccountQuota | null }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(TIP_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!quota || dismissed) return null;

  const { usage } = quota;
  const allowance =
    usage.dailyLimit == null && usage.monthlyLimit != null
      ? `${usage.remainingMonth ?? 0} of ${usage.monthlyLimit} scans left this month`
      : usage.dailyLimit == null
        ? "unlimited scans today"
        : `${usage.remainingToday ?? 0} of ${usage.dailyLimit} scans left today`;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-cyan-300/25 bg-cyan-300/8 px-3 py-2.5 text-xs text-cyan-50",
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
      <p className="min-w-0 flex-1 leading-relaxed">
        <span className="font-semibold text-cyan-100">Scan credits:</span> {allowance}. Each photo or crop
        costs 1 credit.{" "}
        <Link href="/usage" className="font-semibold text-cyan-200 underline-offset-2 hover:underline">
          View usage & plans
        </Link>
      </p>
      <button
        type="button"
        className="shrink-0 rounded p-1 text-cyan-200/70 hover:bg-white/10 hover:text-cyan-100"
        aria-label="Dismiss tip"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(TIP_KEY, "1");
          } catch {
            /* ignore */
          }
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
