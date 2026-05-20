/** Catalog → scanner handoff (query params + builders). */

export type CatalogScanPrefill = {
  catalogId: string;
  name: string;
  set?: string;
  number?: string;
  year?: string;
  rarity?: string;
  printStamps?: string;
  catalogImageUrl?: string;
};

const PREFILL_KEYS = [
  "catalogId",
  "name",
  "set",
  "number",
  "year",
  "rarity",
  "print",
  "img",
] as const;

export function buildScannerPrefillUrl(
  prefill: CatalogScanPrefill,
  targetPath = "/scanner",
): string {
  const params = new URLSearchParams();
  params.set("catalogId", prefill.catalogId.trim());
  params.set("name", prefill.name.trim());
  if (prefill.set?.trim()) params.set("set", prefill.set.trim());
  if (prefill.number?.trim()) params.set("number", prefill.number.trim());
  if (prefill.year?.trim()) params.set("year", prefill.year.trim());
  if (prefill.rarity?.trim()) params.set("rarity", prefill.rarity.trim());
  if (prefill.printStamps?.trim()) params.set("print", prefill.printStamps.trim());
  if (prefill.catalogImageUrl?.trim()) params.set("img", prefill.catalogImageUrl.trim());
  return `${targetPath}?${params.toString()}`;
}

export function parseScannerPrefill(searchParams: URLSearchParams): CatalogScanPrefill | null {
  const catalogId = searchParams.get("catalogId")?.trim() ?? "";
  const name = searchParams.get("name")?.trim() ?? "";
  if (!catalogId || !name) return null;

  const prefill: CatalogScanPrefill = { catalogId, name };
  const set = searchParams.get("set")?.trim();
  const number = searchParams.get("number")?.trim();
  const year = searchParams.get("year")?.trim();
  const rarity = searchParams.get("rarity")?.trim();
  const printStamps = searchParams.get("print")?.trim();
  const catalogImageUrl = searchParams.get("img")?.trim();

  if (set) prefill.set = set;
  if (number) prefill.number = number;
  if (year) prefill.year = year;
  if (rarity) prefill.rarity = rarity;
  if (printStamps) prefill.printStamps = printStamps;
  if (catalogImageUrl) prefill.catalogImageUrl = catalogImageUrl;

  return prefill;
}

export function scannerPrefillQueryKeys(): readonly string[] {
  return PREFILL_KEYS;
}
