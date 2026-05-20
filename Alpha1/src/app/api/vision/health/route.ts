import { NextResponse } from "next/server";
import { getVisionProviderOrder, getVisionSkipProviders } from "@/lib/ai/env";
import {
  getProviderCooldownRemainingMs,
  getVisionMaxOutputTokensForProvider,
  isProviderInCooldown,
  isVisionProviderConfigured,
  type VisionProviderId,
} from "@/lib/ai/vision-providers";

export const dynamic = "force-dynamic";

const ALL: VisionProviderId[] = [
  "groq",
  "gemini",
  "openrouter",
  "openai",
  "xai",
];

export async function GET() {
  const skip = new Set(getVisionSkipProviders());
  const providers = ALL.map((id) => ({
    id,
    configured: isVisionProviderConfigured(id),
    skipped: skip.has(id),
    cooldownMs: getProviderCooldownRemainingMs(id),
    inCooldown: isProviderInCooldown(id),
    maxOutputTokens: getVisionMaxOutputTokensForProvider(id),
    available:
      isVisionProviderConfigured(id) &&
      !skip.has(id) &&
      !isProviderInCooldown(id),
  }));

  const available = providers.filter((p) => p.available).map((p) => p.id);

  return NextResponse.json({
    ok: available.length > 0,
    order: getVisionProviderOrder(),
    skip: Array.from(skip),
    available,
    providers,
  });
}
