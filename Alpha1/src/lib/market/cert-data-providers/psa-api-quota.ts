import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type QuotaState = {
  date: string;
  count: number;
};

const DEFAULT_DAILY_LIMIT = 100;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function quotaPath(): string {
  const dir = process.env.PSA_API_QUOTA_CACHE_DIR?.trim() || join(process.cwd(), ".cache");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "psa-api-quota.json");
}

function readState(): QuotaState {
  const path = quotaPath();
  if (!existsSync(path)) return { date: todayUtc(), count: 0 };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as QuotaState;
    if (!raw?.date) return { date: todayUtc(), count: 0 };
    if (raw.date !== todayUtc()) return { date: todayUtc(), count: 0 };
    return { date: raw.date, count: Number(raw.count) || 0 };
  } catch {
    return { date: todayUtc(), count: 0 };
  }
}

function writeState(state: QuotaState): void {
  writeFileSync(quotaPath(), JSON.stringify(state, null, 2), "utf8");
}

export function getPsaApiDailyLimit(): number {
  const n = Number(process.env.PSA_API_DAILY_LIMIT ?? 100);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY_LIMIT;
}

export function isPsaApiQuotaEnabled(): boolean {
  return process.env.PSA_API_QUOTA_DISABLE !== "1";
}

export function getPsaApiQuotaStatus(): {
  date: string;
  used: number;
  limit: number;
  remaining: number;
} {
  const limit = getPsaApiDailyLimit();
  const used = readState().count;
  return {
    date: todayUtc(),
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/** Reserve one PSA Public API call for today (free plan = 100/day). */
export function tryConsumePsaApiCall(): boolean {
  if (!isPsaApiQuotaEnabled()) return true;
  const limit = getPsaApiDailyLimit();
  const state = readState();
  if (state.count >= limit) return false;
  writeState({ date: state.date, count: state.count + 1 });
  return true;
}

export function canUsePsaApiNow(): boolean {
  if (!isPsaApiQuotaEnabled()) return true;
  return readState().count < getPsaApiDailyLimit();
}
