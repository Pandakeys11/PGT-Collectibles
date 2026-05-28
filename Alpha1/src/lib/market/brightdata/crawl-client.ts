import {
  brightDataCrawlOutputFormat,
  brightDataCrawlPollIntervalMs,
  brightDataPopHarvestTimeoutMs,
  getBrightDataApiKey,
  getBrightDataCrawlDatasetId,
  isBrightDataCrawlConfigured,
} from "@/lib/market/brightdata/config";

const API_BASE = "https://api.brightdata.com";

export type BrightDataCrawlTriggerResult = {
  snapshotId: string;
};

export type BrightDataSnapshotProgress = {
  status: string;
  message?: string;
};

function authHeaders(): HeadersInit {
  const key = getBrightDataApiKey();
  if (!key) throw new Error("brightdata_not_configured");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST /datasets/v3/trigger — returns snapshot_id for async crawl. */
export async function triggerBrightDataCrawl(
  urls: string[],
  options?: { includeErrors?: boolean },
): Promise<BrightDataCrawlTriggerResult> {
  if (!isBrightDataCrawlConfigured()) {
    throw new Error("brightdata_crawl_not_configured");
  }
  const datasetId = getBrightDataCrawlDatasetId();
  if (!datasetId) throw new Error("brightdata_dataset_missing");

  const payload = urls.filter(Boolean).map((url) => ({ url }));
  if (payload.length === 0) throw new Error("brightdata_no_urls");

  const params = new URLSearchParams({
    dataset_id: datasetId,
    include_errors: options?.includeErrors === false ? "false" : "true",
    format: "json",
  });

  const outputField = brightDataCrawlOutputFormat();
  if (outputField) {
    params.set("custom_output_fields", `url|${outputField}`);
  }

  // Bright Data CP sometimes shows a wrapper `{ input: [...] }`.
  // The REST docs show a raw array body. Try wrapper first, then raw array.
  const attempts: unknown[] = [{ input: payload }, payload];
  let text = "";
  let ok = false;
  let status = 0;
  for (const body of attempts) {
    const res = await fetch(`${API_BASE}/datasets/v3/trigger?${params.toString()}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    status = res.status;
    text = await res.text();
    ok = res.ok;
    if (ok) break;
  }
  if (!ok) {
    throw new Error(`brightdata_trigger_${status}: ${text.slice(0, 400)}`);
  }

  let json: { snapshot_id?: string };
  try {
    json = JSON.parse(text) as { snapshot_id?: string };
  } catch {
    throw new Error("brightdata_trigger_invalid_json");
  }

  const snapshotId = json.snapshot_id?.trim();
  if (!snapshotId) throw new Error("brightdata_trigger_missing_snapshot_id");
  return { snapshotId };
}

/** GET /datasets/v3/progress/{snapshot_id} */
export async function getBrightDataSnapshotProgress(
  snapshotId: string,
): Promise<BrightDataSnapshotProgress> {
  const res = await fetch(`${API_BASE}/datasets/v3/progress/${encodeURIComponent(snapshotId)}`, {
    headers: authHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`brightdata_progress_${res.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as BrightDataSnapshotProgress;
  } catch {
    return { status: "unknown", message: text.slice(0, 200) };
  }
}

function isProgressReady(status: string): boolean {
  const s = status.toLowerCase();
  return s === "ready" || s === "done" || s === "complete" || s === "completed";
}

function isProgressFailed(status: string): boolean {
  const s = status.toLowerCase();
  return s === "failed" || s === "error" || s === "cancelled";
}

export async function waitForBrightDataSnapshot(
  snapshotId: string,
  timeoutMs = brightDataPopHarvestTimeoutMs(),
): Promise<BrightDataSnapshotProgress> {
  const deadline = Date.now() + timeoutMs;
  const interval = brightDataCrawlPollIntervalMs();
  let last: BrightDataSnapshotProgress = { status: "running" };

  while (Date.now() < deadline) {
    last = await getBrightDataSnapshotProgress(snapshotId);
    const status = String(last.status ?? "");
    if (isProgressReady(status)) return last;
    if (isProgressFailed(status)) {
      throw new Error(`brightdata_snapshot_failed: ${status} ${last.message ?? ""}`.trim());
    }
    await sleep(interval);
  }

  throw new Error(`brightdata_snapshot_timeout: ${last.status}`);
}

/** GET /datasets/v3/snapshot/{snapshot_id} */
export async function downloadBrightDataSnapshot(
  snapshotId: string,
): Promise<unknown[]> {
  const params = new URLSearchParams({ format: "json" });
  const res = await fetch(
    `${API_BASE}/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?${params.toString()}`,
    {
      headers: authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    },
  );

  const text = await res.text();
  if (res.status === 202) {
    throw new Error("brightdata_snapshot_not_ready");
  }
  if (!res.ok) {
    throw new Error(`brightdata_download_${res.status}: ${text.slice(0, 400)}`);
  }

  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  const lines = trimmed.split(/\n+/).filter(Boolean);
  if (lines.length > 1 && lines.every((l) => l.trim().startsWith("{"))) {
    return lines.map((line) => JSON.parse(line) as unknown);
  }

  try {
    const one = JSON.parse(trimmed) as unknown;
    return Array.isArray(one) ? one : [one];
  } catch {
    return [{ raw: trimmed }];
  }
}

/** Trigger → poll → download in one call. */
export async function crawlUrlsAndDownload(urls: string[]): Promise<unknown[]> {
  const { snapshotId } = await triggerBrightDataCrawl(urls);
  await waitForBrightDataSnapshot(snapshotId);
  return downloadBrightDataSnapshot(snapshotId);
}

/** Extract page body text from a Crawl API result row. */
export function extractCrawlRowContent(row: unknown): string {
  if (!row || typeof row !== "object") {
    return typeof row === "string" ? row : "";
  }
  const r = row as Record<string, unknown>;
  const format = brightDataCrawlOutputFormat();
  const preferred = r[format] ?? r.markdown ?? r.html ?? r.text ?? r.content ?? r.body;
  if (typeof preferred === "string" && preferred.trim()) return preferred;
  if (r.error) return "";
  return JSON.stringify(row);
}
