import { NextRequest, NextResponse } from "next/server";
import { recordPgtObservation, upsertPgtCardIdentity } from "@/lib/pgt-registry/persist";
import { persistMarketIntelFromEnrich } from "@/lib/pgt-registry/pgt-market-intel-persist";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import { extractedCardSchema, marketEvidenceSchema } from "@/lib/scan/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const eventTypes = new Set(["user_confirm", "user_reject", "user_edit"] as const);
type ObservationEventType = "user_confirm" | "user_reject" | "user_edit";

export async function POST(req: NextRequest) {
  let body: {
    eventType?: string;
    specimenId?: string;
    card?: unknown;
    context?: unknown;
    catalogId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = body.eventType;
  if (!eventType || !eventTypes.has(eventType as ObservationEventType)) {
    return NextResponse.json({ error: "eventType required" }, { status: 400 });
  }

  const parsedCard = extractedCardSchema.safeParse(body.card);
  if (!parsedCard.success) {
    return NextResponse.json({ error: "Invalid card payload" }, { status: 400 });
  }

  const appUser = await syncCurrentAppUser();
  const userId = appUser?.id ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const catalogId =
    typeof body.catalogId === "string" && body.catalogId.trim() ? body.catalogId.trim() : null;

  // Phase A: ensure the identity spine learns the user's confirmed catalogId even
  // before the scan is saved as a session.
  const identityId = await upsertPgtCardIdentity(parsedCard.data, catalogId);

  await recordPgtObservation({
    userId,
    pgtCardIdentityId: identityId,
    sessionId: null,
    extractedCardId: null,
    eventType: eventType as ObservationEventType,
    card: parsedCard.data,
    context:
      body.context && typeof body.context === "object" ? (body.context as Record<string, unknown>) : {},
    provider: null,
  });

  if (identityId && catalogId && eventType === "user_confirm") {
    const ctx =
      body.context && typeof body.context === "object"
        ? (body.context as Record<string, unknown>)
        : {};
    const evidenceParsed = marketEvidenceSchema.array().safeParse(ctx.marketEvidence);
    const marketEvidence = evidenceParsed.success ? evidenceParsed.data : [];
    void persistMarketIntelFromEnrich({
      catalogId,
      card: parsedCard.data,
      marketEvidence,
      pgtCardIdentityId: identityId,
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, pgtCardIdentityId: identityId });
}

