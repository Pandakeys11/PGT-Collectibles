import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import { getCardFromDb } from "@/lib/catalog/db-catalog-browse";
import { fetchGraderPageContent } from "@/lib/market/brightdata/fetch-grader-page";
import {
  buildCatalogPopHarvestUrls,
  buildGraderCertUrl,
  type GraderId,
} from "@/lib/market/brightdata/grader-pop-urls";
import {
  parseGraderPopulationFromContent,
  type ParsedGraderPopulation,
} from "@/lib/market/brightdata/pop-parse";
import { isBrightDataPopHarvestEnabled } from "@/lib/market/brightdata/config";
import { isMissingRelationError } from "@/lib/market/supabase-errors";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

const POP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type GraderPopHarvestResult = {
  ok: boolean;
  catalogId: string | null;
  grader: GraderId;
  url: string | null;
  via: string | null;
  gradesWritten: number;
  parsed: ParsedGraderPopulation | null;
  error?: string;
};

async function recentSnapshotExists(
  catalogId: string,
  grader: string,
  grade: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - POP_COOLDOWN_MS).toISOString();
  const { data } = await supabase
    .from("pgt_population_snapshots")
    .select("id")
    .eq("catalog_id", catalogId)
    .eq("grader", grader)
    .eq("grade", grade)
    .gte("captured_at", since)
    .limit(1);
  return Boolean(data?.length);
}

export async function persistGraderPopulationSnapshots(args: {
  catalogId: string;
  franchise?: string;
  parsed: ParsedGraderPopulation;
  source: string;
}): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const catalogId = args.catalogId.trim();
  if (!catalogId || args.parsed.grades.length === 0) return 0;

  const supabase = getSupabaseAdmin();
  const franchise = args.franchise ?? "pokemon";
  let written = 0;

  for (const row of args.parsed.grades) {
    const gradeLabel =
      row.grade === "10" && args.parsed.grader === "PSA"
        ? "10"
        : `${row.grade}`.slice(0, 32);
    if (await recentSnapshotExists(catalogId, args.parsed.grader, gradeLabel)) continue;

    const note =
      args.parsed.rawNote ??
      `${args.parsed.grader} ${row.grade}: ${row.populationCount.toLocaleString()}${
        row.populationHigher != null
          ? ` (higher: ${row.populationHigher.toLocaleString()})`
          : ""
      }`;

    const { error } = await supabase.from("pgt_population_snapshots").insert({
      catalog_id: catalogId,
      franchise,
      grader: args.parsed.grader,
      grade: gradeLabel,
      population_count: row.populationCount,
      population_higher: row.populationHigher,
      population_note: note.slice(0, 500),
      source: args.source,
      captured_at: new Date().toISOString(),
    });
    if (!error) written += 1;
    else if (!isMissingRelationError(error)) {
      /* continue other grades */
    }
  }

  if (args.parsed.totalPopulation != null && written > 0) {
    const totalGrade = "TOTAL";
    if (!(await recentSnapshotExists(catalogId, args.parsed.grader, totalGrade))) {
      await supabase.from("pgt_population_snapshots").insert({
        catalog_id: catalogId,
        franchise,
        grader: args.parsed.grader,
        grade: totalGrade,
        population_count: args.parsed.totalPopulation,
        population_higher: null,
        population_note: `${args.parsed.grader} total graded: ${args.parsed.totalPopulation.toLocaleString()}`,
        source: args.source,
        captured_at: new Date().toISOString(),
      });
    }
  }

  return written;
}

async function harvestUrl(
  url: string,
  grader: GraderId,
): Promise<{ parsed: ParsedGraderPopulation | null; via: string | null }> {
  const page = await fetchGraderPageContent(url);
  if (!page) return { parsed: null, via: null };
  const parsed = parseGraderPopulationFromContent(grader, page.content, page.url);
  return { parsed, via: page.via };
}

/** Harvest population for a PSA/BGS/CGC cert and optional catalog lock. */
export async function harvestGraderPopByCert(args: {
  grader: GraderId;
  certNumber: string;
  catalogId?: string | null;
  franchise?: string;
}): Promise<GraderPopHarvestResult> {
  const grader = args.grader;
  const cert = args.certNumber.replace(/\D/g, "");
  const catalogId = args.catalogId?.trim() || null;

  if (!isBrightDataPopHarvestEnabled()) {
    return {
      ok: false,
      catalogId,
      grader,
      url: null,
      via: null,
      gradesWritten: 0,
      parsed: null,
      error: "brightdata_not_configured",
    };
  }

  const url = buildGraderCertUrl(grader, cert);
  try {
    const { parsed, via } = await harvestUrl(url, grader);
    if (!parsed) {
      return {
        ok: false,
        catalogId,
        grader,
        url,
        via,
        gradesWritten: 0,
        parsed: null,
        error: "parse_failed",
      };
    }

    let gradesWritten = 0;
    if (catalogId) {
      gradesWritten = await persistGraderPopulationSnapshots({
        catalogId,
        franchise: args.franchise,
        parsed,
        source: `brightdata_${via ?? "unknown"}`,
      });
    }

    return {
      ok: true,
      catalogId,
      grader,
      url,
      via,
      gradesWritten,
      parsed,
    };
  } catch (e) {
    return {
      ok: false,
      catalogId,
      grader,
      url,
      via: null,
      gradesWritten: 0,
      parsed: null,
      error: e instanceof Error ? e.message : "harvest_failed",
    };
  }
}

/** Harvest PSA/BGS/CGC population for a master catalog card. */
export async function harvestGraderPopForCatalogCard(
  catalogId: string,
  options?: { graders?: GraderId[]; psaSpecId?: string | number | null },
): Promise<GraderPopHarvestResult[]> {
  const id = catalogId.trim();
  if (!id) return [];

  const card = await getCardFromDb("pokemon", id);
  if (!card) {
    return [
      {
        ok: false,
        catalogId: id,
        grader: "PSA",
        url: null,
        via: null,
        gradesWritten: 0,
        parsed: null,
        error: "not_in_catalog",
      },
    ];
  }

  const graders = options?.graders ?? ["PSA", "BGS", "CGC"];
  const urls = buildCatalogPopHarvestUrls(card, { psaSpecId: options?.psaSpecId });
  const results: GraderPopHarvestResult[] = [];

  for (const grader of graders) {
    const candidates = urls.filter((u) => u.grader === grader);
    let best: GraderPopHarvestResult | null = null;

    for (const candidate of candidates) {
      try {
        const { parsed, via } = await harvestUrl(candidate.url, grader);
        if (!parsed || parsed.grades.length === 0) continue;

        const gradesWritten = await persistGraderPopulationSnapshots({
          catalogId: id,
          franchise: "pokemon",
          parsed,
          source: `brightdata_${via ?? "crawl"}_${candidate.label.replace(/\s+/g, "_").toLowerCase()}`,
        });

        const result: GraderPopHarvestResult = {
          ok: true,
          catalogId: id,
          grader,
          url: candidate.url,
          via,
          gradesWritten,
          parsed,
        };

        if (!best || gradesWritten > best.gradesWritten) best = result;
        if (parsed.grades.length >= 3) break;
      } catch (e) {
        results.push({
          ok: false,
          catalogId: id,
          grader,
          url: candidate.url,
          via: null,
          gradesWritten: 0,
          parsed: null,
          error: e instanceof Error ? e.message : "harvest_failed",
        });
      }
    }

    if (best) results.push(best);
    else if (!results.some((r) => r.grader === grader && !r.ok)) {
      results.push({
        ok: false,
        catalogId: id,
        grader,
        url: candidates[0]?.url ?? null,
        via: null,
        gradesWritten: 0,
        parsed: null,
        error: "no_pop_parsed",
      });
    }
  }

  return results;
}

export type { CatalogCardSummary };
