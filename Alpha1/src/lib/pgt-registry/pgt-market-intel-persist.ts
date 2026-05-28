import { isMissingRelationError } from "@/lib/market/supabase-errors";
import {
  inferCardTargetGradeBucket,
  inferEvidenceGradeBucket,
} from "@/lib/market/market-intelligence";
import { marketIdentityHash } from "@/lib/market/identity-hash";
import { franchiseLabel } from "@/lib/scan/franchise";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import type { RegistrySnapshot } from "@/lib/scan/verification";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

const MAX_COMPS_PER_INGEST = 48;
const POP_SNAPSHOT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function normalizeDateToYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = String(value).trim();
  if (!t) return null;
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

function parsePopulationCounts(populationNote: string | null): {
  population_count: number | null;
  population_higher: number | null;
} {
  if (!populationNote) return { population_count: null, population_higher: null };
  const text = populationNote.trim();
  const slash = text.match(/([\d,]+)\s*\/\s*([\d,]+)/);
  if (slash) {
    const a = Number(slash[1].replace(/,/g, ""));
    const b = Number(slash[2].replace(/,/g, ""));
    return {
      population_count: Number.isFinite(a) ? a : null,
      population_higher: Number.isFinite(b) ? b : null,
    };
  }
  const single = text.match(/(?:population|total)\D*([\d,]+)/i);
  if (!single) return { population_count: null, population_higher: null };
  const a = Number(single[1].replace(/,/g, ""));
  return { population_count: Number.isFinite(a) ? a : null, population_higher: null };
}

function registryFromJson(json: unknown): RegistrySnapshot | null {
  if (!json || typeof json !== "object") return null;
  const r = json as Record<string, unknown>;
  return {
    certNumber: typeof r.certNumber === "string" ? r.certNumber : null,
    cardName: typeof r.cardName === "string" ? r.cardName : null,
    grade: typeof r.grade === "string" ? r.grade : null,
    grader: typeof r.grader === "string" ? r.grader : null,
    registryUrl: typeof r.registryUrl === "string" ? r.registryUrl : null,
    isVerified: r.isVerified === true,
  };
}

/** Keep `pgt_card_identities.catalog_id` aligned with the active catalog lock. */
export async function syncIdentityCatalogId(
  pgtCardIdentityId: string,
  catalogId: string,
): Promise<void> {
  if (!isSupabaseConfigured() || !catalogId.trim()) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("pgt_card_identities")
    .update({
      catalog_id: catalogId.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", pgtCardIdentityId);
  if (error && !isMissingRelationError(error)) {
    /* non-fatal */
  }
}

export async function persistCertificationsAndPopulationSnapshots(args: {
  pgtCardIdentityId: string;
  catalogId: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const catalogId = args.catalogId.trim();
  if (!catalogId) return;

  const supabase = getSupabaseAdmin();

  const { data: identity, error: idErr } = await supabase
    .from("pgt_card_identities")
    .select(
      "grader,cert_number,grade,canonical_name,set_name,card_number,franchise",
    )
    .eq("id", args.pgtCardIdentityId)
    .maybeSingle();
  if (idErr || !identity?.grader || !identity.cert_number) return;

  const { data: slab, error: slabErr } = await supabase
    .from("pgt_slab_registry")
    .select(
      "registry_json,population_note,grade_date,gemrate_id,provider,registry_url,is_verified",
    )
    .eq("grader", identity.grader)
    .eq("cert_number", identity.cert_number)
    .maybeSingle();
  if (slabErr || !slab) return;

  const registry = registryFromJson(slab.registry_json);
  const populationNote = (slab.population_note as string | null) ?? null;
  const { population_count, population_higher } = parsePopulationCounts(populationNote);
  const certGrade = registry?.grade?.trim() || identity.grade?.trim() || null;
  const certCardName = registry?.cardName?.trim() || identity.canonical_name || null;

  const certRow = {
    grader: identity.grader,
    cert_number: identity.cert_number,
    catalog_id: catalogId,
    pgt_card_identity_id: args.pgtCardIdentityId,
    franchise: identity.franchise ?? "pokemon",
    gemrate_id: (slab.gemrate_id as string | null) ?? null,
    grade: certGrade,
    card_name: certCardName,
    set_name: identity.set_name ?? null,
    card_number: identity.card_number ?? null,
    registry_url: slab.registry_url ?? registry?.registryUrl ?? null,
    provider: slab.provider ?? null,
    registry_json: (slab.registry_json ?? {}) as Record<string, unknown>,
    verified_at: slab.is_verified ? new Date().toISOString() : null,
    refreshed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: certErr } = await supabase
    .from("pgt_certifications")
    .upsert(certRow, { onConflict: "grader,cert_number" });
  if (certErr && !isMissingRelationError(certErr)) return;

  await syncIdentityCatalogId(args.pgtCardIdentityId, catalogId);

  const hasPopData =
    populationNote?.trim() ||
    population_count != null ||
    population_higher != null;
  if (!hasPopData) return;

  const since = new Date(Date.now() - POP_SNAPSHOT_COOLDOWN_MS).toISOString();
  const { data: recent } = await supabase
    .from("pgt_population_snapshots")
    .select("id")
    .eq("catalog_id", catalogId)
    .eq("grader", identity.grader)
    .gte("captured_at", since)
    .limit(1);
  if (recent?.length) return;

  const { error: popErr } = await supabase.from("pgt_population_snapshots").insert({
    catalog_id: catalogId,
    franchise: identity.franchise ?? "pokemon",
    grader: identity.grader,
    grade: certGrade,
    population_count,
    population_higher,
    population_note: populationNote,
    source: slab.provider ?? null,
    captured_at: new Date().toISOString(),
  });
  if (popErr && !isMissingRelationError(popErr)) {
    /* non-fatal */
  }
}

export async function persistMarketComps(args: {
  catalogId: string;
  card: ExtractedCard;
  marketEvidence: MarketEvidence[];
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const catalogId = args.catalogId.trim();
  if (!catalogId || args.marketEvidence.length === 0) return;

  const defaultBucket = inferCardTargetGradeBucket(args.card);
  const identity_hash = marketIdentityHash(args.card);
  const franchise = franchiseLabel(args.card).toLowerCase();

  const seen = new Set<string>();
  const rows = args.marketEvidence
    .map((ev) => {
      if (!ev.title?.trim()) return null;
      if (!ev.url && ev.priceUsd == null) return null;
      const grade_bucket = ev.gradeBucket ?? inferEvidenceGradeBucket(ev) ?? defaultBucket;
      const key = `${grade_bucket}|${ev.kind}|${ev.url ?? ""}|${ev.title}|${ev.priceUsd ?? ""}|${ev.observedAt ?? ""}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        catalog_id: catalogId,
        franchise,
        grade_bucket,
        kind: ev.kind,
        title: ev.title.trim().slice(0, 500),
        price_usd: typeof ev.priceUsd === "number" ? ev.priceUsd : null,
        observed_at: normalizeDateToYmd(ev.observedAt),
        url: ev.url ?? null,
        source: ev.source ?? null,
        slab: ev.slab ?? null,
        identity_hash,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .slice(0, MAX_COMPS_PER_INGEST);

  if (rows.length === 0) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("pgt_market_comps").upsert(rows, {
    onConflict:
      "catalog_id,grade_bucket,kind,url,price_usd,observed_at,source,identity_hash",
    ignoreDuplicates: false,
  });
  if (error && !isMissingRelationError(error)) {
    /* non-fatal */
  }
}

/** Phase B bundle: comps + cert/pop when graded slab data exists. */
export async function persistMarketIntelFromEnrich(args: {
  catalogId: string | null;
  card: ExtractedCard;
  marketEvidence: MarketEvidence[];
  pgtCardIdentityId?: string | null;
}): Promise<void> {
  if (!args.catalogId?.trim()) return;
  const catalogId = args.catalogId.trim();

  await persistMarketComps({
    catalogId,
    card: args.card,
    marketEvidence: args.marketEvidence,
  });

  if (args.pgtCardIdentityId) {
    await persistCertificationsAndPopulationSnapshots({
      pgtCardIdentityId: args.pgtCardIdentityId,
      catalogId,
    });
  }
}

export type CatalogMarketIntel = {
  catalogId: string;
  comps: Array<{
    id: string;
    kind: string;
    title: string;
    priceUsd: number | null;
    observedAt: string | null;
    url: string | null;
    source: string | null;
    slab: string | null;
    gradeBucket: string | null;
    ingestedAt: string;
  }>;
  population: Array<{
    grader: string;
    grade: string | null;
    populationCount: number | null;
    populationHigher: number | null;
    populationNote: string | null;
    source: string | null;
    capturedAt: string;
  }>;
  certifications: Array<{
    grader: string;
    certNumber: string;
    grade: string | null;
    cardName: string | null;
    registryUrl: string | null;
    provider: string | null;
    verifiedAt: string | null;
  }>;
};

export async function readCatalogMarketIntel(
  catalogId: string,
  options?: { compLimit?: number },
): Promise<CatalogMarketIntel | null> {
  if (!isSupabaseConfigured()) return null;
  const id = catalogId.trim();
  if (!id) return null;

  const limit = Math.min(100, Math.max(1, options?.compLimit ?? 40));
  const supabase = getSupabaseAdmin();

  const [compsRes, popRes, certRes] = await Promise.all([
    supabase
      .from("pgt_market_comps")
      .select(
        "id,kind,title,price_usd,observed_at,url,source,slab,grade_bucket,ingested_at",
      )
      .eq("catalog_id", id)
      .order("observed_at", { ascending: false, nullsFirst: false })
      .order("ingested_at", { ascending: false })
      .limit(limit),
    supabase
      .from("pgt_population_snapshots")
      .select(
        "grader,grade,population_count,population_higher,population_note,source,captured_at",
      )
      .eq("catalog_id", id)
      .order("captured_at", { ascending: false })
      .limit(24),
    supabase
      .from("pgt_certifications")
      .select(
        "grader,cert_number,grade,card_name,registry_url,provider,verified_at",
      )
      .eq("catalog_id", id)
      .order("refreshed_at", { ascending: false })
      .limit(12),
  ]);

  if (
    isMissingRelationError(compsRes.error ?? {}) ||
    isMissingRelationError(popRes.error ?? {}) ||
    isMissingRelationError(certRes.error ?? {})
  ) {
    return null;
  }

  return {
    catalogId: id,
    comps: (compsRes.data ?? []).map((row) => ({
      id: String(row.id),
      kind: String(row.kind),
      title: String(row.title),
      priceUsd:
        typeof row.price_usd === "number" && Number.isFinite(row.price_usd)
          ? row.price_usd
          : null,
      observedAt: row.observed_at ? String(row.observed_at) : null,
      url: row.url ? String(row.url) : null,
      source: row.source ? String(row.source) : null,
      slab: row.slab ? String(row.slab) : null,
      gradeBucket: row.grade_bucket ? String(row.grade_bucket) : null,
      ingestedAt: String(row.ingested_at),
    })),
    population: (popRes.data ?? []).map((row) => ({
      grader: String(row.grader),
      grade: row.grade ? String(row.grade) : null,
      populationCount:
        typeof row.population_count === "number" ? row.population_count : null,
      populationHigher:
        typeof row.population_higher === "number" ? row.population_higher : null,
      populationNote: row.population_note ? String(row.population_note) : null,
      source: row.source ? String(row.source) : null,
      capturedAt: String(row.captured_at),
    })),
    certifications: (certRes.data ?? []).map((row) => ({
      grader: String(row.grader),
      certNumber: String(row.cert_number),
      grade: row.grade ? String(row.grade) : null,
      cardName: row.card_name ? String(row.card_name) : null,
      registryUrl: row.registry_url ? String(row.registry_url) : null,
      provider: row.provider ? String(row.provider) : null,
      verifiedAt: row.verified_at ? String(row.verified_at) : null,
    })),
  };
}
