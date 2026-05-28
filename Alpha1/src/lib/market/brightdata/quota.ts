import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type QuotaBucket = "ebay" | "cert" | "other";

type QuotaFile = {
  day: string;
  total: number;
  ebay: number;
  cert: number;
  other: number;
};

const CACHE_DIR = join(process.cwd(), ".cache");
const QUOTA_PATH = join(CACHE_DIR, "brightdata-unlocker-quota.json");

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function readQuota(): QuotaFile {
  const day = utcDay();
  if (!existsSync(QUOTA_PATH)) {
    return { day, total: 0, ebay: 0, cert: 0, other: 0 };
  }
  try {
    const raw = JSON.parse(readFileSync(QUOTA_PATH, "utf8")) as QuotaFile;
    if (raw.day !== day) return { day, total: 0, ebay: 0, cert: 0, other: 0 };
    return raw;
  } catch {
    return { day, total: 0, ebay: 0, cert: 0, other: 0 };
  }
}

function writeQuota(q: QuotaFile): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(QUOTA_PATH, JSON.stringify(q, null, 2), "utf8");
}

function dailyBudget(): number {
  const n = Number(process.env.BRIGHTDATA_DAILY_REQUEST_BUDGET ?? 60);
  return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 5000) : 60;
}

function ebayDailyBudget(): number {
  const n = Number(process.env.BRIGHTDATA_EBAY_DAILY_BUDGET ?? 30);
  const cap = dailyBudget();
  return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 0), cap) : Math.min(30, cap);
}

export function getBrightDataQuotaSnapshot(): QuotaFile & {
  dailyBudget: number;
  ebayBudget: number;
  remainingTotal: number;
  remainingEbay: number;
} {
  const q = readQuota();
  const totalCap = dailyBudget();
  const ebayCap = ebayDailyBudget();
  return {
    ...q,
    dailyBudget: totalCap,
    ebayBudget: ebayCap,
    remainingTotal: Math.max(0, totalCap - q.total),
    remainingEbay: Math.max(0, ebayCap - q.ebay),
  };
}

export function isBrightDataUnlockerBudgetAvailable(bucket: QuotaBucket = "other"): boolean {
  const snap = getBrightDataQuotaSnapshot();
  if (snap.remainingTotal <= 0) return false;
  if (bucket === "ebay" && snap.remainingEbay <= 0) return false;
  return true;
}

/** Records one successful unlocker request (call after HTTP 200). */
export function recordBrightDataUnlockerUse(bucket: QuotaBucket = "other"): void {
  const q = readQuota();
  q.total += 1;
  if (bucket === "ebay") q.ebay += 1;
  else if (bucket === "cert") q.cert += 1;
  else q.other += 1;
  writeQuota(q);
}
