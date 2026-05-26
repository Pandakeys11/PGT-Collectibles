const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function cleanId(value: string | null | undefined): string | null {
  const id = value?.trim() ?? "";
  return ID_RE.test(id) ? id : null;
}

export function cleanShortText(
  value: string | null | undefined,
  maxLength = 120,
): string | undefined {
  const text = value?.trim() ?? "";
  if (!text) return undefined;
  return text.slice(0, maxLength);
}

export function cleanPositiveInt(
  value: string | null | undefined,
  fallback: number,
  max: number,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

/** Master catalog language — `ja` for Japanese TCGdex overlay, else English API default. */
export function parseCatalogLanguage(
  value: string | null | undefined,
): "en" | "ja" | undefined {
  const v = value?.trim().toLowerCase();
  if (!v || v === "en" || v === "english") return undefined;
  if (v === "ja" || v === "jp" || v === "jpn" || v === "japanese") return "ja";
  return undefined;
}
