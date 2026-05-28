import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { hasReadableCertNumber } from "@/lib/scan/graded-slab";
import type { ExtractedCard } from "@/lib/scan/schemas";
import { readCachedSlabRegistry, upsertPgtCardIdentity } from "@/lib/pgt-registry/persist";

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

function certDigits(card: ExtractedCard): { grader: string; cert: string } | null {
  if (!hasReadableCertNumber(card.cert)) return null;
  const cert = card.cert!.replace(/\D/g, "");
  const grader = normalizeGrader(card.grader) ?? "PSA";
  if (cert.length < 6) return null;
  return { grader, cert };
}

/**
 * Cached catalog_id from a prior graded scan with this cert (pgt_card_identities).
 */
export async function readCachedCertCatalogId(card: ExtractedCard): Promise<string | null> {
  const ref = certDigits(card);
  if (!ref || !isSupabaseConfigured()) return null;

  const cached = await readCachedSlabRegistry(ref.grader, ref.cert);
  if (cached?.pgtCardIdentityId) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pgt_card_identities")
      .select("catalog_id")
      .eq("id", cached.pgtCardIdentityId)
      .maybeSingle();
    if (!error && data?.catalog_id?.trim()) return data.catalog_id.trim();
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pgt_card_identities")
    .select("catalog_id")
    .eq("grader", ref.grader)
    .eq("cert_number", ref.cert)
    .not("catalog_id", "is", null)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.catalog_id?.trim()) return null;
  return data.catalog_id.trim();
}

/** Persist cert → catalog_id after a trusted enrich so repeat scans get instant art. */
export async function persistCertCatalogBinding(
  card: ExtractedCard,
  catalogId: string,
): Promise<void> {
  const id = catalogId.trim();
  if (!id || !isSupabaseConfigured()) return;
  const ref = certDigits(card);
  if (!ref) return;
  try {
    await upsertPgtCardIdentity(card, id);
  } catch {
    /* non-fatal */
  }
}
