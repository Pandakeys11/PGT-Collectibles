function slugify(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function resolveMarketSetName(_setId: string, setName: string): string {
  return setName.trim();
}

function normalizeMarketName(value: string): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCardNumber(
  cardNumber: string | null,
  setTotal?: string | number | null,
  printedTotal?: string | number | null,
): string {
  const raw = String(cardNumber ?? "").trim();
  if (!raw) return "";
  const total = setTotal != null ? String(setTotal) : printedTotal != null ? String(printedTotal) : "";
  if (total && raw.includes("/")) return raw;
  if (total && !raw.includes("/")) return `${raw}/${total}`;
  return raw;
}

export function polishPriceChartingQuery(q: string): string {
  return String(q ?? "")
    .replace(/\breverse\s+holofoils?\b/gi, "reverse holo")
    .replace(/\bholofoils?\b/gi, "holo")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildPriceChartingGameProductSlug(input: {
  name: string;
  cardNumber?: string | null;
  isFirstEdition?: boolean;
  isShadowless?: boolean;
  isReverseHolofoil?: boolean;
}): string {
  const marketName = normalizeMarketName(input.name) || input.name;
  const numOnly = String(input.cardNumber ?? "").split("/")[0]?.trim() ?? "";
  const parts = [
    marketName,
    input.isFirstEdition ? "1st Edition" : "",
    input.isShadowless ? "Shadowless" : "",
    input.isReverseHolofoil ? "reverse holo" : "",
    numOnly,
  ];
  return slugify(polishPriceChartingQuery(parts.filter(Boolean).join(" ")));
}

export function buildPriceChartingSearchQueries(input: {
  name: string;
  setId?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  isFirstEdition?: boolean;
  isShadowless?: boolean;
  isReverseHolofoil?: boolean;
  isPromo?: boolean;
  gradeLabel?: string | null;
  setTotal?: string | number | null;
  printedTotal?: string | number | null;
}): string[] {
  const marketName = polishPriceChartingQuery(normalizeMarketName(input.name) || input.name);
  const setLabel = resolveMarketSetName(input.setId ?? "", input.setName ?? "").trim();
  const fullNum = normalizeCardNumber(
    input.cardNumber ?? null,
    input.setTotal ?? null,
    input.printedTotal ?? null,
  );
  const numOnly = String(input.cardNumber ?? "").split("/")[0].trim();
  const variant = [input.isFirstEdition ? "1st Edition" : "", input.isShadowless ? "Shadowless" : "", input.isReverseHolofoil ? "reverse holo" : ""]
    .filter(Boolean)
    .join(" ");
  const promoHint = input.isPromo ? "Pokemon Promo" : "";

  const queries = new Set<string>();
  const add = (q: string) => {
    const t = polishPriceChartingQuery(q.trim());
    if (t.length >= 3) queries.add(t);
  };

  add([marketName, variant, numOnly, setLabel].filter(Boolean).join(" "));
  add([marketName, setLabel, variant, fullNum].filter(Boolean).join(" "));
  add([marketName, setLabel, numOnly].filter(Boolean).join(" "));
  add([marketName, fullNum].filter(Boolean).join(" "));
  add([marketName, promoHint, numOnly].filter(Boolean).join(" "));
  if (input.gradeLabel) add([marketName, setLabel, fullNum, input.gradeLabel].filter(Boolean).join(" "));

  return Array.from(queries);
}

export function buildPriceChartingDirectUrls(input: {
  name: string;
  setId?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  isFirstEdition?: boolean;
  isShadowless?: boolean;
  isReverseHolofoil?: boolean;
  setTotal?: string | number | null;
  printedTotal?: string | number | null;
}): string[] {
  const setLabel = resolveMarketSetName(input.setId ?? "", input.setName ?? "").trim();
  if (!setLabel) return [];
  const setSlug = slugify(setLabel);
  const productSlug = buildPriceChartingGameProductSlug({
    name: input.name,
    cardNumber: input.cardNumber ?? null,
    isFirstEdition: Boolean(input.isFirstEdition),
    isShadowless: Boolean(input.isShadowless),
    isReverseHolofoil: Boolean(input.isReverseHolofoil),
  });
  if (!productSlug || !setSlug) return [];
  return [
    `https://www.pricecharting.com/game/pokemon-${setSlug}/${productSlug}`,
    `https://www.pricecharting.com/game/${setSlug}/${productSlug}`,
  ].map((url) => `${url}#completed-auctions-used`);
}

export function toPriceChartingHistoryUrl(url: string | null | undefined): string | null {
  const raw = String(url ?? "").trim();
  if (!raw) return null;
  if (!/^https?:\/\/(www\.)?pricecharting\.com\//i.test(raw)) return null;
  if (/\/search-products\?/i.test(raw)) return null;
  if (/\/game\//i.test(raw)) {
    return raw.includes("#completed-auctions-used")
      ? raw
      : `${raw}#completed-auctions-used`;
  }
  return raw;
}
