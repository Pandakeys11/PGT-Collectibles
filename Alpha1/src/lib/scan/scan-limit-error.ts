import type { ConsumeCreditsResult } from "@/lib/auth/usage";

export type ScanLimitReason = "daily_limit" | "monthly_limit" | "suspended" | "user_not_found";

export type ScanLimitPayload = {
  reason: ScanLimitReason;
  dailyUsed: number;
  monthlyUsed: number;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  bonusScans?: number;
};

export class ScanLimitError extends Error {
  readonly payload: ScanLimitPayload;

  constructor(payload: ScanLimitPayload) {
    super("Scan limit reached");
    this.name = "ScanLimitError";
    this.payload = payload;
  }
}

export function isScanLimitError(err: unknown): err is ScanLimitError {
  return err instanceof ScanLimitError;
}

export function scanLimitMessage(payload: ScanLimitPayload): string {
  if (payload.reason === "daily_limit") {
    return "Daily scan limit reached";
  }
  if (payload.reason === "monthly_limit") {
    return "Monthly scan limit reached";
  }
  if (payload.reason === "suspended") {
    return "Scanning is disabled on this account";
  }
  return "Scan limit reached";
}

export function parseScanLimitFromResponse(
  status: number,
  data: {
    error?: string;
    reason?: string;
    usage?: Partial<ConsumeCreditsResult> & { bonus_scans?: number };
  },
): ScanLimitError | null {
  if (status !== 429 || data.error !== "Scan limit reached") return null;
  const reason = data.reason ?? data.usage?.reason ?? "daily_limit";
  if (
    reason !== "daily_limit" &&
    reason !== "monthly_limit" &&
    reason !== "suspended" &&
    reason !== "user_not_found"
  ) {
    return new ScanLimitError({
      reason: "daily_limit",
      dailyUsed: data.usage?.dailyUsed ?? 0,
      monthlyUsed: data.usage?.monthlyUsed ?? 0,
      dailyLimit: data.usage?.dailyLimit ?? null,
      monthlyLimit: data.usage?.monthlyLimit ?? null,
      bonusScans: data.usage?.bonus_scans,
    });
  }
  return new ScanLimitError({
    reason,
    dailyUsed: data.usage?.dailyUsed ?? 0,
    monthlyUsed: data.usage?.monthlyUsed ?? 0,
    dailyLimit: data.usage?.dailyLimit ?? null,
    monthlyLimit: data.usage?.monthlyLimit ?? null,
    bonusScans: data.usage?.bonus_scans,
  });
}
