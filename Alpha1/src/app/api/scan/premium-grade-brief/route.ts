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

  const raw = body as { card?: unknown };
  const parsed = extractedCardSchema.safeParse(raw.card);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid card payload" }, { status: 400 });
  }

  const appUser = await getCurrentAppUser();
  const proTier = appUser ? isProTierPlan(appUser.plan) : false;

  const result = await runPremiumGradeWebBrief(parsed.data, { proTier });

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
