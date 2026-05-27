import type {
  CatalogCardSummary,
  CatalogPaginated,
  CatalogSetSummary,
} from "@/lib/catalog/catalog-types";
import { releaseYearFromDate } from "@/lib/catalog/catalog-types";

type OptcgSet = {
  set_id?: string;
  id?: string;
  setId?: string;
  set_name?: string;
  name?: string;
  release_date?: string;
  card_count?: number;
};

type OptcgCard = {
  card_set_id?: string;
  id?: string;
  card_name?: string;
  name?: string;
  set_name?: string;
  rarity?: string;
  card_image?: string;
};

export async function listOnepieceSets(params: {
  page: number;
  pageSize: number;
  q?: string;
}): Promise<CatalogPaginated<CatalogSetSummary>> {
  const res = await fetch("https://optcgapi.com/api/allSets/", {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`OPTCG sets ${res.status}`);
  let sets = (await res.json()) as OptcgSet[];
  if (params.q?.trim()) {
    const needle = params.q.trim().toLowerCase();
    sets = sets.filter((s) => {
      const name = (s.set_name ?? s.name ?? "").toLowerCase();
      const id = String(s.set_id ?? s.id ?? s.setId ?? "").toLowerCase();
      return name.includes(needle) || id.includes(needle);
    });
  }
  const start = (params.page - 1) * params.pageSize;
  const slice = sets.slice(start, start + params.pageSize);
  return {
    data: slice.map((s) => {
      const id = String(s.set_id ?? s.id ?? s.setId ?? "");
      return {
        id,
        name: s.set_name ?? s.name ?? id,
        code: id,
        series: null,
        releaseDate: s.release_date ?? null,
        year: releaseYearFromDate(s.release_date),
        printedTotal: s.card_count ?? null,
        total: s.card_count ?? null,
        franchise: "onepiece" as const,
      };
    }),
    page: params.page,
    pageSize: params.pageSize,
    count: slice.length,
    totalCount: sets.length,
  };
}

function normalizeOptcgCards(payload: unknown): OptcgCard[] {
  if (Array.isArray(payload)) return payload as OptcgCard[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.cards)) return record.cards as OptcgCard[];
    if (Array.isArray(record.data)) return record.data as OptcgCard[];
  }
  return [];
}

export async function listOnepieceCards(
  setId: string,
  params: { page: number; pageSize: number; q?: string },
): Promise<CatalogPaginated<CatalogCardSummary>> {
  const res = await fetch(`https://optcgapi.com/api/sets/${encodeURIComponent(setId)}/`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`OPTCG cards ${res.status}`);
  let cards = normalizeOptcgCards(await res.json());
  if (params.q?.trim()) {
    const needle = params.q.trim().toLowerCase();
    cards = cards.filter((c) =>
      (c.card_name ?? c.name ?? "").toLowerCase().includes(needle),
    );
  }
  const start = (params.page - 1) * params.pageSize;
  const slice = cards.slice(start, start + params.pageSize);
  return {
    data: slice.map((c) => optcgCardToSummary(c, setId)),
    page: params.page,
    pageSize: params.pageSize,
    count: slice.length,
    totalCount: cards.length,
  };
}

export async function getOnepieceCard(catalogId: string): Promise<CatalogCardSummary | null> {
  const id = catalogId.replace(/^optcg:/, "");
  const match = id.match(/^(.+)$/);
  if (!match) return null;
  const sets = await fetch("https://optcgapi.com/api/allSets/").then((r) => r.json());
  for (const set of (sets ?? []) as OptcgSet[]) {
    const setId = String(set.set_id ?? set.id ?? set.setId ?? "");
    if (!setId) continue;
    const cards = normalizeOptcgCards(await fetch(`https://optcgapi.com/api/sets/${encodeURIComponent(setId)}/`).then(
      (r) => r.json(),
    ));
    const hit = cards.find(
      (c) => String(c.card_set_id ?? c.id) === id,
    );
    if (hit) return optcgCardToSummary(hit, setId);
  }
  return null;
}

function optcgCardToSummary(card: OptcgCard, setId: string): CatalogCardSummary {
  const cid = String(card.card_set_id ?? card.id ?? "");
  return {
    id: `optcg:${cid}`,
    name: card.card_name ?? card.name ?? "Unknown",
    number: cid,
    rarity: card.rarity ?? null,
    supertype: null,
    images: card.card_image ? { small: card.card_image, large: card.card_image } : undefined,
    set: { id: setId, name: card.set_name ?? setId, code: setId },
    franchise: "onepiece",
  };
}
