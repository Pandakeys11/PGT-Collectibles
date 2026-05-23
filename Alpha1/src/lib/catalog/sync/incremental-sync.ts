/**
 * Incremental catalog sync — upserts new/changed sets and refreshes card rows for recent sets.
 * Full backfill: `npm run catalog:sync:all`
 * Scheduled: GET /api/catalog/sync (CRON_SECRET)
 */

import { upsertCatalogCards, touchCatalogSourceSync } from "@/lib/catalog/db-catalog";
import type { CatalogSetUpsert } from "@/lib/catalog/db-catalog-browse";
import { upsertCatalogSets } from "@/lib/catalog/db-catalog-browse";
import type { CatalogFranchiseId } from "@/lib/catalog/catalog-types";
import type { CatalogCardUpsert } from "@/lib/catalog/db-catalog";

const USER_AGENT = "PGTVision/1.0 catalog-sync";

export type SyncResult = {
  franchise: string;
  setsUpserted: number;
  cardsUpserted: number;
  error?: string;
};

function searchText(parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s/.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecentRelease(releaseDate: string | null | undefined, days = 120): boolean {
  if (!releaseDate) return true;
  const t = Date.parse(releaseDate);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t < days * 24 * 60 * 60 * 1000;
}

async function syncMagicSetsAndRecentCards(): Promise<SyncResult> {
  const result: SyncResult = { franchise: "magic", setsUpserted: 0, cardsUpserted: 0 };
  try {
    const res = await fetch("https://api.scryfall.com/sets", {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`Scryfall ${res.status}`);
    const payload = (await res.json()) as {
      data?: Array<{
        id: string;
        code: string;
        name: string;
        released_at?: string;
        card_count?: number;
        set_type?: string;
      }>;
    };
    const sets = (payload.data ?? []).filter(
      (s) =>
        s.set_type === "expansion" ||
        s.set_type === "core" ||
        s.set_type === "masters",
    );
    const setRows: CatalogSetUpsert[] = sets.map((s) => ({
      franchise: "magic",
      externalSetId: s.code,
      name: s.name,
      code: s.code,
      releaseDate: s.released_at ?? null,
      cardCount: s.card_count ?? null,
      sourceId: "scryfall.com",
      rawJson: { scryfallId: s.id, set_type: s.set_type },
    }));
    result.setsUpserted = await upsertCatalogSets(setRows);

    const recent = sets.filter((s) => isRecentRelease(s.released_at));
    const cardRows: CatalogCardUpsert[] = [];
    for (const set of recent.slice(0, 8)) {
      let next = `https://api.scryfall.com/cards/search?order=set&q=e:${encodeURIComponent(set.code)}&unique=prints`;
      while (next && cardRows.length < 8000) {
        const page = await fetch(next, { headers: { "User-Agent": USER_AGENT } }).then((r) =>
          r.json(),
        );
        for (const card of page?.data ?? []) {
          cardRows.push({
            franchise: "magic" as CatalogFranchiseId,
            catalogId: `scryfall:${card.id}`,
            name: card.name,
            printedName: card.printed_name ?? null,
            setName: card.set_name ?? set.name,
            setCode: set.code,
            cardNumber: card.collector_number ?? null,
            year: card.released_at?.slice(0, 4) ?? null,
            rarity: card.rarity ?? null,
            imageSmallUrl: card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small ?? null,
            imageLargeUrl: card.image_uris?.large ?? card.card_faces?.[0]?.image_uris?.large ?? null,
            pricesJson: { tcgPlayerUrl: card.purchase_uris?.tcgplayer ?? null },
            rawJson: { scryfallId: card.id },
            sourceId: "scryfall.com",
          });
        }
        next = page?.has_more ? page.next_page : null;
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    result.cardsUpserted = await upsertCatalogCards(cardRows);
    await touchCatalogSourceSync("scryfall.com");
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}

async function syncLorcanaLorcast(): Promise<SyncResult> {
  const result: SyncResult = { franchise: "lorcana", setsUpserted: 0, cardsUpserted: 0 };
  try {
    const setsPayload = await fetch("https://api.lorcast.com/v0/sets").then((r) => {
      if (!r.ok) throw new Error(`Lorcast ${r.status}`);
      return r.json();
    });
    const sets = (setsPayload?.results ?? []) as Array<{
      id: string;
      name: string;
      code: string;
      released_at?: string;
    }>;
    result.setsUpserted = await upsertCatalogSets(
      sets.map((s) => ({
        franchise: "lorcana",
        externalSetId: s.code,
        name: s.name,
        code: s.code,
        releaseDate: s.released_at ?? null,
        cardCount: null,
        sourceId: "lorcast.com",
      })),
    );

    const cardRows: CatalogCardUpsert[] = [];
    const recent = sets.filter((s) => isRecentRelease(s.released_at));
    for (const set of recent) {
      const search = await fetch(
        `https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(`set:${set.code}`)}`,
      ).then((r) => r.json());
      for (const card of search?.results ?? []) {
        const name = card.version ? `${card.name} — ${card.version}` : card.name;
        const imgs = card.image_uris?.digital;
        cardRows.push({
          franchise: "lorcana",
          catalogId: `lorcana:${card.id}`,
          name,
          printedName: card.name ?? null,
          setName: card.set?.name ?? set.name,
          setCode: set.code,
          cardNumber: String(card.collector_number ?? ""),
          year: set.released_at?.slice(0, 4) ?? null,
          rarity: card.rarity ?? null,
          imageSmallUrl: imgs?.small ?? imgs?.normal ?? null,
          imageLargeUrl: imgs?.large ?? imgs?.normal ?? null,
          pricesJson: { tcgPlayerUrl: card.purchase_uris?.tcgplayer ?? null },
          rawJson: { lorcastId: card.id },
          sourceId: "lorcast.com",
        });
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    result.cardsUpserted = await upsertCatalogCards(cardRows);
    await touchCatalogSourceSync("lorcast.com");
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}

async function syncOnepieceSets(): Promise<SyncResult> {
  const result: SyncResult = { franchise: "onepiece", setsUpserted: 0, cardsUpserted: 0 };
  try {
    const sets = await fetch("https://optcgapi.com/api/allSets/").then((r) => r.json());
    const setRows: CatalogSetUpsert[] = [];
    const cardRows: CatalogCardUpsert[] = [];
    for (const set of sets ?? []) {
      const setId = set.set_id ?? set.id ?? set.setId;
      if (!setId) continue;
      setRows.push({
        franchise: "onepiece",
        externalSetId: String(setId),
        name: set.set_name ?? set.name ?? String(setId),
        code: String(setId),
        releaseDate: set.release_date ?? null,
        cardCount: set.card_count ?? null,
        sourceId: "optcgapi.com",
      });
      if (!isRecentRelease(set.release_date, 365)) continue;
      const cards = await fetch(
        `https://optcgapi.com/api/sets/${encodeURIComponent(String(setId))}/`,
      ).then((r) => r.json());
      for (const card of cards ?? []) {
        const id = card.card_set_id ?? card.id;
        if (!id) continue;
        cardRows.push({
          franchise: "onepiece",
          catalogId: `optcg:${id}`,
          name: card.card_name ?? card.name ?? "Unknown",
          setName: card.set_name ?? set.set_name ?? null,
          setCode: String(setId),
          cardNumber: String(id),
          rarity: card.rarity ?? null,
          imageSmallUrl: card.card_image ?? null,
          imageLargeUrl: card.card_image ?? null,
          pricesJson: {},
          rawJson: { setId },
          sourceId: "optcgapi.com",
        });
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    result.setsUpserted = await upsertCatalogSets(setRows);
    result.cardsUpserted = await upsertCatalogCards(cardRows);
    await touchCatalogSourceSync("optcgapi.com");
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}

async function syncPokemonRecentSets(): Promise<SyncResult> {
  const result: SyncResult = { franchise: "pokemon", setsUpserted: 0, cardsUpserted: 0 };
  const key = process.env.POKEMON_TCG_API_KEY?.trim();
  const headers: HeadersInit = { Accept: "application/json" };
  if (key) (headers as Record<string, string>)["X-Api-Key"] = key;

  try {
    const setsRes = await fetch(
      "https://api.pokemontcg.io/v2/sets?pageSize=250&orderBy=-releaseDate",
      { headers },
    );
    if (!setsRes.ok) throw new Error(`Pokemon sets ${setsRes.status}`);
    const setsPayload = (await setsRes.json()) as {
      data?: Array<{
        id: string;
        name: string;
        series: string;
        releaseDate: string;
        total: number;
        printedTotal: number;
        images?: { symbol?: string; logo?: string };
      }>;
    };
    const allSets = setsPayload.data ?? [];
    const setRows: CatalogSetUpsert[] = allSets.map((s) => ({
      franchise: "pokemon",
      externalSetId: s.id,
      name: s.name,
      code: s.id,
      releaseDate: s.releaseDate?.replace(/\//g, "-") ?? null,
      cardCount: s.total ?? s.printedTotal ?? null,
      sourceId: "pokemontcg.io",
      rawJson: { series: s.series, images: s.images },
    }));
    result.setsUpserted = await upsertCatalogSets(setRows);

    const recentSets = allSets.filter((s) => isRecentRelease(s.releaseDate?.replace(/\//g, "-")));
    const cardRows: CatalogCardUpsert[] = [];
    for (const set of recentSets.slice(0, 12)) {
      let page = 1;
      let cardsInSet = 0;
      for (;;) {
        const u = new URL("https://api.pokemontcg.io/v2/cards");
        u.searchParams.set("q", `set.id:${set.id}`);
        u.searchParams.set("page", String(page));
        u.searchParams.set("pageSize", "250");
        const res = await fetch(u.toString(), { headers });
        if (!res.ok) break;
        const body = (await res.json()) as { data?: unknown[]; totalCount?: number };
        const pageCards = (body.data ?? []) as Array<Record<string, unknown>>;
        for (const card of pageCards) {
          const images = card.images as { small?: string; large?: string } | undefined;
          const setEmbed = card.set as { name?: string } | undefined;
          cardRows.push({
            franchise: "pokemon",
            catalogId: `pokemon:${String(card.id)}`,
            name: String(card.name ?? "Unknown"),
            setName: setEmbed?.name ?? set.name,
            setCode: set.id,
            cardNumber: String(card.number ?? ""),
            year: set.releaseDate?.slice(0, 4) ?? null,
            rarity: String(card.rarity ?? "") || null,
            imageSmallUrl: images?.small ?? null,
            imageLargeUrl: images?.large ?? null,
            pricesJson: {
              tcgPlayerUrl:
                (card.tcgplayer as { url?: string } | undefined)?.url ?? null,
            },
            rawJson: { pokemonId: card.id },
            sourceId: "pokemontcg.io",
          });
        }
        cardsInSet += pageCards.length;
        const setTotal = body.totalCount ?? cardsInSet;
        if (!pageCards.length || cardsInSet >= setTotal) break;
        page += 1;
        await new Promise((r) => setTimeout(r, 80));
      }
    }
    result.cardsUpserted = await upsertCatalogCards(cardRows);
    await touchCatalogSourceSync("pokemontcg.io");
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}

/** Incremental sync safe for cron (time-bounded). */
export async function runIncrementalCatalogSync(): Promise<{
  ok: boolean;
  results: SyncResult[];
}> {
  const results: SyncResult[] = [];
  results.push(await syncPokemonRecentSets());
  results.push(await syncMagicSetsAndRecentCards());
  results.push(await syncLorcanaLorcast());
  results.push(await syncOnepieceSets());
  const ok = results.every((r) => !r.error);
  return { ok, results };
}
