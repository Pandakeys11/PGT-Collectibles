/**
 * Parse printed collector fractions (e.g. 17/111, #3/82) for reconciliation with official set sizes.
 */
export function parseCollectorFraction(number: string | undefined): { num: string; den: number } | null {
  const t = (number ?? "").trim();
  const m = t.match(/^#?\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!m) return null;
  const den = Number(m[2]);
  if (!Number.isFinite(den) || den <= 0) return null;
  const num = m[1].replace(/^0+(?=\d)/, "") || m[1];
  return { num, den };
}

/** True when `number` looks like a bare Pokédex index, not a printed collector fraction. */
export function isDexLikeCardNumberOnly(number: string | undefined): boolean {
  const t = (number ?? "").trim();
  if (!t) return false;
  if (/\d+\s*\/\s*\d+/.test(t)) return false;
  return /^#?\s*\d{1,4}\s*$/.test(t);
}
