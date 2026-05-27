import type {
  CatalogCardSummary,
  CatalogPaginated,
  CatalogSetSummary,
} from "@/lib/catalog/catalog-types";
import { releaseYearFromDate } from "@/lib/catalog/catalog-types";

const USER_AGENT = "PGTVision/1.0 (catalog-browse)";

type ScryfallSet = {
  id: string;
  code: string;
  name: string;
  released_at?: string;
  card_count?: number;
  printed_size?: number;
  icon_svg_uri?: string;
  set_type?: string;
};

type ScryfallCard = {
  id: string;
  name: string;
  set: string;
  set_name?: string;
  collector_number?: string;
  rarity?: string;
  type_line?: string;
  image_uris?: { small?: string; large?: string };
  card_faces?: Array<{ image_uris?: { small?: string; large?: string } }>;
  purchase_uris?: { tcgplayer?: string };
};

export async function listMagicSets(params: {
  page: number;
  pageSize: number;
  q?: string;
}): Promise<CatalogPaginated<CatalogSetSummary>> {
  const res = await fetch("https://api.scryfall.com/sets", {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Scryfall sets failed (${res.status})`);
  const payload = (await res.json()) as { data?: ScryfallSet[] };
  let sets = (payload.data ?? []).filter(
    (s) => s.set_type === "expansion" || s.set_type === "core" || s.set_type === "masters",
  );
  if (params.q?.trim()) {
    const needle = params.q.trim().toLowerCase();
    sets = sets.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) || s.code.toLowerCase().includes(needle),
    );
  }
  sets.sort((a, b) => (b.released_at ?? "").localeCompare(a.released_at ?? ""));
  const start = (params.page - 1) * params.pageSize;
  const slice = sets.slice(start, start + params.pageSize);
  return {
    data: slice.map(scryfallSetToSummary),
    page: params.page,
    pageSize: params.pageSize,
    count: slice.length,
    totalCount: sets.length,
  };
}

export async function listMagicCards(
  setCode: string,
  params: { page: number; pageSize: number; q?: string },
): Promise<CatalogPaginated<CatalogCardSummary>> {
  const code = setCode.trim();
  let q = `e:${code} game:paper`;
  if (params.q?.trim()) {
    q += ` name:${params.q.trim()}`;
  }
  const url = new URL("https://api.scryfall.com/cards/search");
  url.searchParams.set("q", q);
  url.searchParams.set("unique", "prints");
  url.searchParams.set("order", "set");

  const allCards: ScryfallCard[] = [];
  let apiPage = 1;
  let totalCards = 0;

  for (;;) {
    url.searchParams.set("page", String(apiPage));
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 1800 },
    });
    if (!res.ok) {
      if (res.status === 404 && allCards.length === 0) {
        return { data: [], page: params.page, pageSize: params.pageSize, count: 0, totalCount: 0 };
      }
      throw new Error(`Scryfall cards failed (${res.status})`);
    }
    const payload = (await res.json()) as {
      data?: ScryfallCard[];
      total_cards?: number;
      has_more?: boolean;
    };
    totalCards = payload.total_cards ?? totalCards;
    const batch = payload.data ?? [];
    allCards.push(...batch);
    if (!payload.has_more || batch.length === 0) break;
    apiPage += 1;
    if (apiPage > 40) break;
  }

  const start = (params.page - 1) * params.pageSize;
  const slice = allCards.slice(start, start + params.pageSize);
  return {
    data: slice.map((c) => scryfallCardToSummary(c, code)),
    page: params.page,
    pageSize: params.pageSize,
    count: slice.length,
    totalCount: totalCards || allCards.length,
  };
}

export async function getMagicCard(catalogId: string): Promise<CatalogCardSummary | null> {
  const id = catalogId.replace(/^scryfall:/, "").trim();
  const res = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(id)}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const card = (await res.json()) as ScryfallCard;
  return scryfallCardToSummary(card, card.set);
}

function scryfallSetToSummary(s: ScryfallSet): CatalogSetSummary {
  return {
    id: s.code,
    name: s.name,
    code: s.code,
    series: s.set_type ?? null,
    releaseDate: s.released_at ?? null,
    year: releaseYearFromDate(s.released_at),
    printedTotal: s.printed_size ?? s.card_count ?? null,
    total: s.card_count ?? null,
    images: s.icon_svg_uri ? { logo: s.icon_svg_uri } : undefined,
    franchise: "magic",
  };
}

function scryfallCardToSummary(c: ScryfallCard, setCode: string): CatalogCardSummary {
  const imgs = c.image_uris ?? c.card_faces?.[0]?.image_uris;
  return {
    id: `scryfall:${c.id}`,
    name: c.name,
    number: c.collector_number ?? null,
    rarity: c.rarity ?? null,
    supertype: c.type_line?.split("—")[0]?.trim() ?? null,
    images: { small: imgs?.small, large: imgs?.large ?? imgs?.small },
    set: { id: setCode, name: c.set_name ?? setCode, code: setCode },
    franchise: "magic",
    tcgplayer: c.purchase_uris?.tcgplayer ? { url: c.purchase_uris.tcgplayer } : undefined,
  };
}
