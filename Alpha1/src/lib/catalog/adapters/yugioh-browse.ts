import type {
  CatalogCardSummary,
  CatalogPaginated,
  CatalogSetSummary,
} from "@/lib/catalog/catalog-types";
import { releaseYearFromDate } from "@/lib/catalog/catalog-types";

type YgoCardSet = {
  set_name: string;
  set_code: string;
  num_of_cards?: number;
  tcg_date?: string;
};

type YgoCard = {
  id: number;
  name: string;
  type?: string;
  card_sets?: Array<{ set_name?: string; set_code?: string; set_rarity?: string }>;
  card_images?: Array<{ image_url?: string; image_url_small?: string }>;
};

export async function listYugiohSets(params: {
  page: number;
  pageSize: number;
  q?: string;
}): Promise<CatalogPaginated<CatalogSetSummary>> {
  const res = await fetch("https://db.ygoprodeck.com/api/v7/cardsets.php", {
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`YGOPRODeck sets ${res.status}`);
  const sets = (await res.json()) as YgoCardSet[];
  let filtered = sets;
  if (params.q?.trim()) {
    const needle = params.q.trim().toLowerCase();
    filtered = sets.filter(
      (s) =>
        s.set_name.toLowerCase().includes(needle) ||
        s.set_code.toLowerCase().includes(needle),
    );
  }
  filtered.sort((a, b) => (b.tcg_date ?? "").localeCompare(a.tcg_date ?? ""));
  const start = (params.page - 1) * params.pageSize;
  const slice = filtered.slice(start, start + params.pageSize);
  return {
    data: slice.map((s) => ({
      id: s.set_code,
      name: s.set_name,
      code: s.set_code,
      series: null,
      releaseDate: s.tcg_date ?? null,
      year: releaseYearFromDate(s.tcg_date),
      printedTotal: s.num_of_cards ?? null,
      total: s.num_of_cards ?? null,
      franchise: "yugioh" as const,
    })),
    page: params.page,
    pageSize: params.pageSize,
    count: slice.length,
    totalCount: filtered.length,
  };
}

export async function listYugiohCards(
  setCode: string,
  params: { page: number; pageSize: number; q?: string },
): Promise<CatalogPaginated<CatalogCardSummary>> {
  const code = setCode.trim();
  const url = new URL("https://db.ygoprodeck.com/api/v7/cardinfo.php");
  url.searchParams.set("cardset", code);
  if (params.q?.trim()) url.searchParams.set("fname", params.q.trim());

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`YGOPRODeck cards ${res.status}`);
  const payload = (await res.json()) as { data?: YgoCard[] };
  const all = payload.data ?? [];
  const start = (params.page - 1) * params.pageSize;
  const slice = all.slice(start, start + params.pageSize);
  return {
    data: slice.map((c) => ygoCardToSummary(c, code)),
    page: params.page,
    pageSize: params.pageSize,
    count: slice.length,
    totalCount: all.length,
  };
}

export async function getYugiohCard(catalogId: string): Promise<CatalogCardSummary | null> {
  const id = catalogId.replace(/^ygo:/, "").split(":")[0];
  const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${encodeURIComponent(id)}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as { data?: YgoCard[] };
  const card = payload.data?.[0];
  if (!card) return null;
  const setCode = card.card_sets?.[0]?.set_code ?? "unknown";
  return ygoCardToSummary(card, setCode);
}

function ygoCardToSummary(card: YgoCard, setCode: string): CatalogCardSummary {
  const setRow = card.card_sets?.find((s) => s.set_code === setCode) ?? card.card_sets?.[0];
  const img = card.card_images?.[0];
  return {
    id: `ygo:${card.id}${setRow?.set_code ? `:${setRow.set_code}` : ""}`,
    name: card.name,
    number: setRow?.set_code ?? null,
    rarity: setRow?.set_rarity ?? null,
    supertype: card.type ?? null,
    images: {
      small: img?.image_url_small ?? img?.image_url,
      large: img?.image_url,
    },
    set: {
      id: setCode,
      name: setRow?.set_name ?? setCode,
      code: setRow?.set_code ?? setCode,
    },
    franchise: "yugioh",
  };
}
