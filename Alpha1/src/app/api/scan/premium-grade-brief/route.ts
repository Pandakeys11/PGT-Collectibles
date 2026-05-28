import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentAppUser } from "@/lib/auth/app-user";
import { isProTierPlan } from "@/lib/auth/plans";
import { runPremiumGradeWebBrief } from "@/lib/scanner-chat/premium-grade-brief";
import { extractedCardSchema } from "@/lib/scan/schemas";

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  await auth.protect();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body as { card?: unknown; sessionEvidence?: unknown };
  const parsed = extractedCardSchema.safeParse(raw.card);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid card payload" }, { status: 400 });
  }

  const sessionEvidence = Array.isArray(raw.sessionEvidence)
    ? raw.sessionEvidence
        .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
        .map((row) => ({
          kind: String(row.kind ?? ""),
          title: String(row.title ?? ""),
          priceUsd:
            typeof row.priceUsd === "number" && Number.isFinite(row.priceUsd) ? row.priceUsd : null,
          observedAt: typeof row.observedAt === "string" ? row.observedAt : null,
          source: typeof row.source === "string" ? row.source : null,
          slab: typeof row.slab === "string" ? row.slab : null,
        }))
        .filter((row) => row.title.trim())
    : undefined;

  const appUser = await getCurrentAppUser();
  const proTier = appUser ? isProTierPlan(appUser.plan) : false;

  const result = await runPremiumGradeWebBrief(parsed.data, { proTier, sessionEvidence });

  if (!result.configured) {
    return NextResponse.json({
      ...result,
      error: "Web research unavailable — set GEMINI_API_KEY or OPENROUTER_API_KEY.",
    });
  }

  if (!result.markdown.trim()) {
    return NextResponse.json({
      ...result,
      error: "Web brief returned empty — try again in a moment.",
    });
  }

  return NextResponse.json(result);
}
