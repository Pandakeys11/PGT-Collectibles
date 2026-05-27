import type {
  CatalogCardSummary,
  CatalogPaginated,
  CatalogSetSummary,
} from "@/lib/catalog/catalog-types";
import { releaseYearFromDate } from "@/lib/catalog/catalog-types";

const LORCAST = "https://api.lorcast.com/v0";

type LorcastSet = {
  id: string;
  name: string;
  code: string;
  released_at?: string;
};

type LorcastCard = {
  id: string;
  name: string;
  version?: string | null;
  collector_number?: string;
  rarity?: string;
  set?: { name?: string; code?: string };
  image_uris?: { digital?: { small?: string; normal?: string; large?: string } };
  purchase_uris?: { tcgplayer?: string };
};

export async function listLorcanaSets(params: {
  page: number;
  pageSize: number;
  q?: string;
}): Promise<CatalogPaginated<CatalogSetSummary>> {
  const res = await fetch(`${LORCAST}/sets`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Lorcast sets ${res.status}`);
  const payload = (await res.json()) as { results?: LorcastSet[] };
  let sets = payload.results ?? [];
  if (params.q?.trim()) {
    const needle = params.q.trim().toLowerCase();
    sets = sets.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        s.code.toLowerCase().includes(needle),
    );
  }
  sets.sort((a, b) => (b.released_at ?? "").localeCompare(a.released_at ?? ""));
  const start = (params.page - 1) * params.pageSize;
  const slice = sets.slice(start, start + params.pageSize);
  return {
    data: slice.map((s) => ({
      id: s.code,
      name: s.name,
      code: s.code,
      series: null,
      releaseDate: s.released_at ?? null,
      year: releaseYearFromDate(s.released_at),
      printedTotal: null,
      total: null,
      franchise: "lorcana" as const,
    })),
    page: params.page,
    pageSize: params.pageSize,
    count: slice.length,
    totalCount: sets.length,
  };
}

export async function listLorcanaCards(
  setCode: string,
  params: { page: number; pageSize: number; q?: string },
): Promise<CatalogPaginated<CatalogCardSummary>> {
  let q = `set:${setCode.trim()}`;
  if (params.q?.trim()) q += ` ${params.q.trim()}`;
  const url = new URL(`${LORCAST}/cards/search`);
  url.searchParams.set("q", q);

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`Lorcast search ${res.status}`);
  const payload = (await res.json()) as { results?: LorcastCard[] };
  const all = payload.results ?? [];
  const start = (params.page - 1) * params.pageSize;
  const slice = all.slice(start, start + params.pageSize);
  return {
    data: slice.map((c) => lorcanaCardToSummary(c, setCode)),
    page: params.page,
    pageSize: params.pageSize,
    count: slice.length,
    totalCount: all.length,
  };
}

function lorcanaCardToSummary(card: LorcastCard, setCode: string): CatalogCardSummary {
  const name = card.version?.trim() ? `${card.name} — ${card.version}` : card.name;
  const imgs = card.image_uris?.digital;
  return {
    id: `lorcana:${card.id}`,
    name,
    number: card.collector_number ?? null,
    rarity: card.rarity ?? null,
    supertype: null,
    images: {
      small: imgs?.small ?? imgs?.normal ?? undefined,
      large: imgs?.large ?? imgs?.normal ?? undefined,
    },
    set: {
      id: setCode,
      name: card.set?.name ?? setCode,
      code: card.set?.code ?? setCode,
    },
    franchise: "lorcana",
    tcgplayer: card.purchase_uris?.tcgplayer
      ? { url: card.purchase_uris.tcgplayer }
      : undefined,
  };
}
