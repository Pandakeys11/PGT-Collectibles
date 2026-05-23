import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import { hydrateRegistryFromCard } from "@/lib/market/hydrate-registry-from-card";
import { buildScanCardContext } from "@/lib/scan/context-builder";
import { mergeRegistrySlabIntoCard, normalizeGradedSlabFields } from "@/lib/scan/graded-slab";
import { extractedCardSchema } from "@/lib/scan/schemas";

export const maxDuration = 60;

/** Lazy cert registry + cert-specific comps when a graded row is selected. */
export async function POST(req: NextRequest) {
  await auth.protect();

  let body: { card?: unknown; specimenId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = extractedCardSchema.safeParse(body.card);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid card payload" }, { status: 400 });
  }

  const appUser = await syncCurrentAppUser();
  const card = normalizeGradedSlabFields(parsed.data);
  const reg = await hydrateRegistryFromCard(card, {
    includeCertMarket: true,
    persist: true,
    userId: appUser?.id ?? null,
  });
  const cardOut = mergeRegistrySlabIntoCard(card, reg.registry);

  const specimenId = String(body.specimenId ?? "registry").trim() || "registry";
  const context = buildScanCardContext({
    specimenId,
    card: cardOut,
    registry: reg.registry,
    populationSummary: reg.populationSummary,
    certProvider: reg.provider,
    certGradeDate: reg.gradeDate,
    certMarketEvidence: reg.certMarketEvidence,
  });

  return NextResponse.json({
    card: cardOut,
    context,
    registry: reg.registry,
    populationSummary: reg.populationSummary,
    provider: reg.provider,
    gradeDate: reg.gradeDate,
    gemrateId: reg.gemrateId,
    certMarketEvidence: reg.certMarketEvidence,
    fromCache: reg.fromCache,
    registryUrl: reg.registry?.registryUrl ?? null,
    pgtCardIdentityId: reg.pgtCardIdentityId,
  });
}
