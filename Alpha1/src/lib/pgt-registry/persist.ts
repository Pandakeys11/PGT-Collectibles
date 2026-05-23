import { analyzeMarketEvidence } from "@/lib/market/market-intelligence";
import { isMissingRelationError } from "@/lib/market/supabase-errors";
import type { CertLookupResult } from "@/lib/market/cert-data-providers/types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { classifyCardLane } from "@/lib/scan/lane";
import { franchiseLabel } from "@/lib/scan/franchise";
import type { ExtractedCard, ScanCardContext } from "@/lib/scan/schemas";
import { hasReadableCertNumber } from "@/lib/scan/graded-slab";
import { buildVariantKey, pgtIdentityHash } from "@/lib/pgt-registry/identity";

export type PgtObservationEvent =
  | "session_save"
  | "registry_hydrate"
  | "enrich_complete"
  | "user_confirm"
  | "user_reject"
  | "user_edit";

const SLAB_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeGrader(raw: string | null | undefined): string | null {
  const g = raw?.trim().toUpperCase();
  if (!g) return null;
  if (g.includes("BECKETT") || g === "BGS") return "BGS";
  if (g.includes("CGC")) return "CGC";
  if (g.includes("SGC")) return "SGC";
  if (g.includes("TAG")) return "TAG";
  if (g.includes("PSA")) return "PSA";
  return g.slice(0, 12);
}

export async function upsertPgtCardIdentity(
  card: ExtractedCard,
  catalogId?: string | null,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const lane = classifyCardLane(card as Record<string, unknown>).lane;
  const identityHash = pgtIdentityHash(card);
  const cert = hasReadableCertNumber(card.cert) ? card.cert!.replace(/\D/g, "") : null;

  const row = {
    identity_hash: identityHash,
    franchise: franchiseLabel(card).toLowerCase(),
    canonical_name: card.name?.trim() || card.printedName?.trim() || "Unknown",
    set_name: card.set?.trim() ?? null,
    card_number: card.number?.trim() ?? null,
    year: card.year?.trim() ?? null,
    variant_key: buildVariantKey(card),
    lane,
    grader: lane === "graded" ? normalizeGrader(card.grader) : null,
    grade: lane === "graded" ? card.grade?.trim() ?? null : null,
    cert_number: cert,
    catalog_id: catalogId?.trim() ?? null,
    last_seen_at: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("pgt_card_identities")
    .select("id, observation_count")
    .eq("identity_hash", identityHash)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("pgt_card_identities")
      .update({
        ...row,
        observation_count: (existing.observation_count ?? 0) + 1,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error && !isMissingRelationError(error)) return null;
    return data?.id ?? existing.id;
  }

  const { data, error } = await supabase
    .from("pgt_card_identities")
    .insert({ ...row, observation_count: 1 })
    .select("id")
    .single();

  if (error) {
    if (isMissingRelationError(error)) return null;
    return null;
  }
  return data?.id ?? null;
}

export async function readCachedSlabRegistry(
  grader: string,
  cert: string,
): Promise<{
  registry: CertLookupResult["registry"];
  populationNote: string | null;
  provider: string | null;
  gradeDate: string | null;
  gemrateId: string | null;
  registryUrl: string | null;
  pgtCardIdentityId: string | null;
} | null> {
  if (!isSupabaseConfigured()) return null;
  const g = normalizeGrader(grader);
  const digits = cert.replace(/\D/g, "");
  if (!g || digits.length < 6) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pgt_slab_registry")
    .select(
      "registry_json, population_note, grade_date, gemrate_id, registry_url, is_verified, provider, refreshed_at, pgt_card_identity_id",
    )
    .eq("grader", g)
    .eq("cert_number", digits)
    .maybeSingle();

  if (error || !data) return null;

  const refreshed = data.refreshed_at ? new Date(data.refreshed_at).getTime() : 0;
  if (Date.now() - refreshed > SLAB_CACHE_TTL_MS) return null;

  const registryJson = data.registry_json as CertLookupResult["registry"] | null;
  return {
    registry: registryJson ?? {
      certNumber: digits,
      cardName: null,
      grade: null,
      grader: g,
      registryUrl: data.registry_url,
      isVerified: data.is_verified ?? false,
    },
    populationNote: data.population_note ?? null,
    provider: data.provider ?? null,
    gradeDate: data.grade_date ?? null,
    gemrateId: data.gemrate_id ?? null,
    registryUrl: data.registry_url ?? null,
    pgtCardIdentityId: data.pgt_card_identity_id ?? null,
  };
}

export async function upsertPgtSlabRegistry(args: {
  grader: string;
  cert: string;
  hit: CertLookupResult;
  card?: ExtractedCard | null;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const g = normalizeGrader(args.grader);
  const digits = args.cert.replace(/\D/g, "");
  if (!g || digits.length < 6) return null;

  let identityId: string | null = null;
  if (args.card) {
    identityId = await upsertPgtCardIdentity(args.card);
  }

  const supabase = getSupabaseAdmin();
  const row = {
    grader: g,
    cert_number: digits,
    pgt_card_identity_id: identityId,
    provider: args.hit.provider,
    registry_json: args.hit.registry,
    population_note: args.hit.populationNote,
    grade_date: args.hit.gradeDate,
    gemrate_id: args.hit.gemrateId,
    registry_url: args.hit.registry.registryUrl,
    is_verified: args.hit.registry.isVerified,
    refreshed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("pgt_slab_registry")
    .upsert(row, { onConflict: "grader,cert_number" })
    .select("id")
    .single();

  if (error && !isMissingRelationError(error)) return null;
  return data?.id ?? null;
}

export async function recordPgtObservation(args: {
  userId?: string | null;
  pgtCardIdentityId?: string | null;
  sessionId?: string | null;
  extractedCardId?: string | null;
  eventType: PgtObservationEvent;
  card: ExtractedCard;
  context?: Partial<ScanCardContext> | Record<string, unknown> | null;
  provider?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const ctx = args.context as Partial<ScanCardContext> | null | undefined;
  const rawEvidence = ctx?.marketEvidence;
  const evidence = Array.isArray(rawEvidence) ? rawEvidence : [];
  const intel = evidence.length
    ? analyzeMarketEvidence(evidence, {
        card: args.card,
        gradeCard: args.card,
        stickerUsd:
          typeof ctx?.askingUsd === "number"
            ? ctx.askingUsd
            : typeof args.card.extractedPrice === "number"
              ? args.card.extractedPrice
              : null,
      })
    : null;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("pgt_card_observations").insert({
    user_id: args.userId ?? null,
    pgt_card_identity_id: args.pgtCardIdentityId ?? null,
    session_id: args.sessionId ?? null,
    extracted_card_id: args.extractedCardId ?? null,
    event_type: args.eventType,
    catalog_identity_status: ctx?.catalogIdentityStatus ?? null,
    confidence: ctx?.confidence ?? intel?.confidence ?? null,
    fmv_usd: ctx?.fairValueUsd ?? intel?.fmvUsd ?? null,
    grade_bucket: intel?.targetBucket ?? null,
    provider: args.provider ?? null,
    payload_json: {
      card: args.card,
      context: ctx ?? {},
    },
    observed_at: new Date().toISOString(),
  });

  if (error && !isMissingRelationError(error)) {
    /* non-fatal */
  }
}

export async function linkExtractedCardToIdentity(
  extractedCardId: string,
  pgtCardIdentityId: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("extracted_cards")
    .update({ pgt_card_identity_id: pgtCardIdentityId })
    .eq("id", extractedCardId);
  if (error && !isMissingRelationError(error)) {
    /* non-fatal */
  }
}
