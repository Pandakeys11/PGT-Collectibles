/** Normalize Bright Data /request API body (raw HTML or JSON wrapper). */
export function unwrapBrightDataResponseBody(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("{")) return trimmed;

  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    const inner =
      (typeof json.body === "string" && json.body) ||
      (typeof json.response === "string" && json.response) ||
      (typeof json.content === "string" && json.content) ||
      (typeof json.html === "string" && json.html) ||
      null;
    return inner?.trim() ?? trimmed;
  } catch {
    return trimmed;
  }
}

export function brightDataBodyLooksLikeHtml(body: string): boolean {
  const s = body.slice(0, 4000).toLowerCase();
  return (
    s.includes("<html") ||
    s.includes("<body") ||
    s.includes("s-item") ||
    s.includes("srp-results") ||
    s.includes("itm/")
  );
}
