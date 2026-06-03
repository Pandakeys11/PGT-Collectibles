import "server-only";

import { getSlabzApiBaseUrl, getSlabzApiKey } from "@/lib/slabz/config";

export type SlabzApiErrorBody = {
  code?: string;
  message?: string;
};

export class SlabzApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, body: SlabzApiErrorBody | null) {
    const message = body?.message ?? `Slabz API error (${status})`;
    super(message);
    this.name = "SlabzApiError";
    this.code = body?.code ?? "SLABZ_ERROR";
    this.status = status;
  }
}

type SlabzEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: SlabzApiErrorBody;
};

export async function slabzPartnerFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; status: number }> {
  const key = getSlabzApiKey();
  if (!key) {
    throw new SlabzApiError(503, {
      code: "SLABZ_NOT_CONFIGURED",
      message: "Slabz partner API key is not configured on this deployment.",
    });
  }

  const base = getSlabzApiBaseUrl().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-Key": key,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let json: SlabzEnvelope<T> | null = null;
  try {
    json = (await res.json()) as SlabzEnvelope<T>;
  } catch {
    json = null;
  }

  if (!res.ok || !json?.success) {
    const err = json?.error ?? null;
    const details = (err as { details?: { message?: string; path?: string }[] } | null)?.details;
    if (details?.length && err?.message === "Validation failed") {
      const detailMsg = details.map((d) => `${d.path ?? "?"}: ${d.message ?? ""}`).join("; ");
      throw new SlabzApiError(res.status, {
        ...err,
        message: `Validation failed — ${detailMsg}`,
      });
    }
    throw new SlabzApiError(res.status, err);
  }

  return { data: json.data as T, status: res.status };
}

/** Full partner JSON envelope (data + pagination fields on list endpoints). */
export async function slabzPartnerFetchEnvelope(
  path: string,
  init?: RequestInit,
): Promise<{ body: Record<string, unknown>; status: number }> {
  const key = getSlabzApiKey();
  if (!key) {
    throw new SlabzApiError(503, {
      code: "SLABZ_NOT_CONFIGURED",
      message: "Slabz partner API key is not configured on this deployment.",
    });
  }

  const base = getSlabzApiBaseUrl().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-Key": key,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let json: Record<string, unknown> | null = null;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = null;
  }

  if (!res.ok || !json?.success) {
    const err = json?.error as SlabzApiErrorBody | undefined;
    throw new SlabzApiError(res.status, err ?? null);
  }

  return { body: json, status: res.status };
}
