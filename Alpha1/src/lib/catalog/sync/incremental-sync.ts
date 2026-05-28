/**
 * Incremental catalog sync — upserts new/changed sets and refreshes card rows for recent sets.
 * Full backfill: `npm run catalog:sync:all`
 * Scheduled: GET /api/catalog/sync (CRON_SECRET)
 */

import { pricesJsonForPokemonCatalogCard } from "@/lib/catalog/catalog-price-snapshot";
import { syncSetCatalogPricesFromTcgApi } from "@/lib/catalog/catalog-set-price-sync";
import { upsertCatalogCards, touchCatalogSourceSync } from "@/lib/catalog/db-catalog";
import type { CatalogSetUpsert } from "@/lib/catalog/db-catalog-browse";
import { upsertCatalogSets } from "@/lib/catalog/db-catalog-browse";
import type { CatalogFranchiseId } from "@/lib/catalog/catalog-types";
import type { CatalogCardUpsert } from "@/lib/catalog/db-catalog";
import { fetchAllCardsForSet, CATALOG_SET_PRICING_SELECT } from "@/lib/pokedex/tcg-api-server";

const USER_AGENT = "PGTVision/1.0 catalog-sync";

export type SyncResult = {
  franchise: string;
  setsUpserted: number;
  cardsUpserted: number;
  error?: string;
};

function isRecentRelease(releaseDate: string | null | undefined, days = 120): boolean {
  if (!releaseDate) return true;
  const t = Date.parse(releaseDate);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t < days * 24 * 60 * 60 * 1000;
}

async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit = {},
  options: { attempts?: number; timeoutMs?: number; label?: string } = {},
): Promise<T> {
  const attempts = options.attempts ?? 4;
  const label = options.label ?? url;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(options.timeoutMs ?? 45_000),
      });
      if (res.ok) return (await res.json()) as T;
      lastError = new Error(`${label} ${res.status}`);
      if (![408, 429, 500, 502, 503, 504].includes(res.status)) throw lastError;
    } catch (e) {
      lastError = e;
    }
    if (attempt < attempts - 1) {
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
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
  const githubHeaders: HeadersInit = {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  };

  try {
    const allSets = await fetchJsonWithRetry<
      Array<{
        id: string;
        name: string;
        series: string;
        releaseDate: string;
        total: number;
        printedTotal: number;
        images?: { symbol?: string; logo?: string };
      }>
    >("https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json", { headers: githubHeaders }, {
      label: "PokemonTCG data sets",
      timeoutMs: 60_000,
    });
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
    const setsToPrice: string[] = [];

    for (const set of recentSets.slice(0, 12)) {
      setsToPrice.push(set.id);
      let apiCards: Awaited<ReturnType<typeof fetchAllCardsForSet>> = [];
      try {
        apiCards = await fetchAllCardsForSet({
          setId: set.id,
          select: CATALOG_SET_PRICING_SELECT,
        });
      } catch {
        apiCards = [];
      }
      const apiById = new Map(apiCards.map((c) => [c.id, c]));

      const pageCards = await fetchJsonWithRetry<Array<Record<string, unknown>>>(
        `https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/${set.id}.json`,
        { headers: githubHeaders },
        { label: `PokemonTCG data ${set.id}`, timeoutMs: 60_000 },
      ).catch(() => []);

      for (const card of pageCards) {
        const images = card.images as { small?: string; large?: string } | undefined;
        const pokemonId = String(card.id);
        const apiCard = apiById.get(pokemonId);
        cardRows.push({
          franchise: "pokemon",
          catalogId: pokemonId,
          name: String(card.name ?? "Unknown"),
          setName: set.name,
          setCode: set.id,
          cardNumber: String(card.number ?? ""),
          year: set.releaseDate?.slice(0, 4) ?? null,
          rarity: String(card.rarity ?? "") || null,
          imageSmallUrl: images?.small ?? null,
          imageLargeUrl: images?.large ?? null,
          pricesJson: pricesJsonForPokemonCatalogCard(
            { id: pokemonId, tcgplayer: card.tcgplayer as { url?: string } | undefined },
            apiCard ?? null,
          ),
          rawJson: { pokemonId },
          sourceId: "pokemontcg.io",
        });
      }
    }

    result.cardsUpserted = await upsertCatalogCards(cardRows);
    await touchCatalogSourceSync("pokemontcg.io");

    if (process.env.CATALOG_SYNC_SKIP_PRICE_HYDRATE !== "1") {
      for (const setId of setsToPrice.slice(0, 4)) {
        try {
          await syncSetCatalogPricesFromTcgApi(setId);
        } catch {
          /* non-fatal — rows already have API merge when fetch succeeded */
        }
      }
    }
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
