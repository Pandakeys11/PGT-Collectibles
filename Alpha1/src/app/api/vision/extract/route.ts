import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getVisionProviderTimeoutMs,
  getVisionSkipProviders,
} from "@/lib/ai/env";
import { isMasterAdminEmail } from "@/lib/auth/admin";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import { consumeScanCredits } from "@/lib/auth/usage";
import { buildVisionPrompt } from "@/lib/ai/vision-prompts";
import {
  formatVisionProviderError,
  listEnabledVisionProviders,
  listEnabledVisionProvidersForBinderGrid,
  isProviderInCooldown,
  isVisionProviderConfigured,
  noteProviderFailure,
  runVisionProviderOnce,
  getGeminiVisionVerifyModel,
} from "@/lib/ai/vision-providers";
import { withTimeout } from "@/lib/async-timeout";
import {
  classifyCardLane,
  scrubHallucinatedSlabFieldsForRaw,
} from "@/lib/scan/lane";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_IMAGES_PER_REQUEST = 12;
const MAX_IMAGE_BASE64_CHARS = 24 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BASE64_CHARS = 96 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function normalizeCards(cards: unknown[]): unknown[] {
  return cards.map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const card = { ...(raw as Record<string, unknown>) };
    const lane = classifyCardLane(card);
    card.visionLane = lane.lane;
    card.visionLaneConfidence = lane.confidence;
    if (lane.lane === "raw" && lane.confidence >= 0.75) {
      return scrubHallucinatedSlabFieldsForRaw(card);
    }
    return card;
  });
}

function summarizeVisionFailure(errors: string[]): string {
  const joined = errors.join(" | ");
  const hints: string[] = [];
  if (/quota|rate limit/i.test(joined)) {
    hints.push(
      "Add VISION_SKIP_PROVIDERS=gemini,openai in .env.local or wait for quota reset. Groq + OpenRouter are the reliable free paths.",
    );
  }
  if (/truncated|invalid JSON|salvaged/i.test(joined)) {
    hints.push(
      "Large binder pages may need a second scan; compact retry runs automatically when JSON is truncated.",
    );
  }
  if (/timed out/i.test(joined)) {
    hints.push(
      "Raise VISION_PROVIDER_TIMEOUT_MS=150000 or use a faster OpenRouter vision model.",
    );
  }
  return hints.length > 0 ? `${joined} — ${hints.join(" ")}` : joined;
}

type VerifyRun = {
  cards: unknown[];
  provider: string;
  salvaged?: boolean;
  compactRetry?: boolean;
  finishReason?: string | null;
};

async function runVerifyPassWithFallback(args: {
  prompt: string;
  compactPrompt: string;
  imageBase64: string;
  imageMimeType: string;
  skippedProviders: Set<string>;
  timeoutMs: number;
}): Promise<{ result: VerifyRun | null; warnings: string[] }> {
  const providers = ["openrouter", "gemini", "openai", "xai"] as const;
  const warnings: string[] = [];
  for (const id of providers) {
    if (args.skippedProviders.has(id)) continue;
    if (!isVisionProviderConfigured(id)) continue;
    if (isProviderInCooldown(id)) continue;
    try {
      const verified = await withTimeout(
        runVisionProviderOnce(
          id,
          args.prompt,
          args.compactPrompt,
          [args.imageBase64],
          [args.imageMimeType],
          id === "gemini"
            ? {
                allowCompactRetry: true,
                geminiModelOverride: getGeminiVisionVerifyModel(),
              }
            : { allowCompactRetry: true },
        ),
        Math.min(args.timeoutMs, 90_000),
        `verify_${id}`,
      );
      if (verified.cards.length > 0) {
        return {
          result: {
            cards: verified.cards,
            provider: id,
            salvaged: verified.salvaged,
            compactRetry: verified.compactRetry,
            finishReason: verified.finishReason,
          },
          warnings,
        };
      }
      warnings.push(`${id}: verify empty extraction`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`${id}: verify failed (${msg})`);
    }
  }
  return { result: null, warnings };
}

export async function POST(req: NextRequest) {
  const bypassToken = process.env.DEV_VISION_BYPASS_TOKEN?.trim();
  const bypassHeader = req.headers.get("x-pgt-dev-bypass")?.trim();
  const canBypass =
    process.env.NODE_ENV !== "production" &&
    bypassToken &&
    bypassHeader &&
    bypassHeader === bypassToken;
  if (!canBypass) {
    await auth.protect();
  }

  let body: {
    imageBase64s?: string[];
    imageMimeTypes?: string[];
    singleCardCrop?: boolean;
    gradedFocus?: boolean;
    binderGrid?: boolean;
    /** Optional second pass using Gemini to verify/fix extraction. */
    visionVerify?: boolean;
    /** Bill one scan when sending multiple tile images for a single binder page. */
    scanCreditCount?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const singleCardCrop = body.singleCardCrop === true;
  const gradedFocus = body.gradedFocus === true;
  const binderGrid = body.binderGrid === true && !singleCardCrop;
  const visionVerify = body.visionVerify === true;
  const prompt = buildVisionPrompt({
    singleCardCrop,
    compact: false,
    gradedFocus,
    binderGrid,
  });
  const compactPrompt = buildVisionPrompt({
    singleCardCrop,
    compact: true,
    gradedFocus,
    binderGrid,
  });
  const compactDensePrompt = binderGrid
    ? buildVisionPrompt({
        singleCardCrop,
        compact: true,
        compactDense: true,
        gradedFocus,
        binderGrid,
      })
    : undefined;
  const imageBase64s = Array.isArray(body.imageBase64s)
    ? body.imageBase64s.filter((v) => typeof v === "string" && v.length > 0)
    : [];
  const imageMimeTypes = Array.isArray(body.imageMimeTypes)
    ? body.imageMimeTypes.filter(
        (v) => typeof v === "string" && v.startsWith("image/"),
      )
    : [];
  if (imageBase64s.length === 0) {
    return NextResponse.json(
      { error: "imageBase64s required" },
      { status: 400 },
    );
  }
  const scanCreditCount =
    typeof body.scanCreditCount === "number" && Number.isFinite(body.scanCreditCount)
      ? Math.max(1, Math.min(Math.floor(body.scanCreditCount), imageBase64s.length))
      : imageBase64s.length;
  const timeoutMs =
    binderGrid && imageBase64s.length > 4
      ? Math.max(getVisionProviderTimeoutMs(), 180_000)
      : getVisionProviderTimeoutMs();
  if (imageBase64s.length > MAX_IMAGES_PER_REQUEST) {
    return NextResponse.json(
      { error: `At most ${MAX_IMAGES_PER_REQUEST} images per scan request` },
      { status: 413 },
    );
  }
  const totalImageChars = imageBase64s.reduce(
    (sum, value) => sum + value.length,
    0,
  );
  if (totalImageChars > MAX_TOTAL_IMAGE_BASE64_CHARS) {
    return NextResponse.json(
      { error: "Image payload too large" },
      { status: 413 },
    );
  }
  for (const [index, value] of imageBase64s.entries()) {
    if (value.length > MAX_IMAGE_BASE64_CHARS) {
      return NextResponse.json(
        { error: `Image ${index + 1} is too large` },
        { status: 413 },
      );
    }
    const mimeType = imageMimeTypes[index] ?? "image/jpeg";
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${mimeType}` },
        { status: 415 },
      );
    }
  }

  let appUser;
  try {
    appUser = await syncCurrentAppUser();
  } catch {
    // If Clerk/Supabase sync fails, allow extraction to proceed without metering.
    // Metering will be enforced on the next scan when appUser sync is healthy again.
    appUser = null;
  }

  if (appUser && !isMasterAdminEmail(appUser.email)) {
    try {
      const creditResult = await consumeScanCredits({
        userId: appUser.id,
        credits: scanCreditCount,
        route: "/api/vision/extract",
        metadata: {
          imageCount: imageBase64s.length,
          scanCreditCount,
          singleCardCrop,
          binderGrid,
        },
      });

      if (!creditResult.allowed) {
        return NextResponse.json(
          {
            error: "Scan limit reached",
            reason: creditResult.reason,
            usage: creditResult,
          },
          { status: 429 },
        );
      }
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Unable to reserve scan credits",
        },
        { status: 503 },
      );
    }
  }

  const enabled = binderGrid
    ? listEnabledVisionProvidersForBinderGrid()
    : listEnabledVisionProviders();
  if (enabled.length === 0) {
    return NextResponse.json(
      {
        error:
          "No vision providers available. Configure GROQ_API_KEY and/or OPENROUTER_API_KEY, or remove entries from VISION_SKIP_PROVIDERS.",
      },
      { status: 503 },
    );
  }

  const errors: string[] = [];
  const skipped = getVisionSkipProviders();
  if (skipped.length > 0) {
    errors.push(`skipped by config: ${skipped.join(", ")}`);
  }
  const skippedSet = new Set(skipped);

  const verifyEligible =
    imageBase64s.length === 1;

  const verifyPrompt = verifyEligible
    ? `${prompt}

VERIFY PASS:
- Re-read the image carefully and correct any obvious mistakes in name/set/number/year/grader/grade/cert.
- Do not invent cert numbers on raw cards or when cert is not legible in-frame.
- Keep the JSON schema identical. Return JSON only.`
    : null;

  const verifyCompactPrompt = verifyEligible
    ? `${compactPrompt}

VERIFY PASS:
- Re-read the image carefully and correct mistakes.
- Return JSON only.`
    : null;

  for (const providerId of enabled) {
    try {
      const result = await withTimeout(
        binderGrid && imageBase64s.length > 1
          ? (async () => {
              const verifyCap = visionVerify
                ? Math.min(imageBase64s.length, 8)
                : 3;

              const tileResults = await Promise.all(
                imageBase64s.map(async (b64, tileIndex) => {
                  const tileMime = imageMimeTypes[tileIndex] ?? "image/jpeg";
                  const tileResult = await runVisionProviderOnce(
                    providerId,
                    prompt,
                    compactPrompt,
                    [b64],
                    [tileMime],
                    {
                      allowCompactRetry: true,
                      compactDensePrompt,
                    },
                  );
                  return { tileIndex, tileResult, b64, tileMime };
                }),
              );

              const tileNeedsVerify = (
                tile: (typeof tileResults)[number],
              ): boolean =>
                Boolean(
                  visionVerify ||
                    tile.tileResult.salvaged ||
                    tile.tileResult.compactRetry ||
                    tile.tileResult.finishReason === "length" ||
                    tile.tileResult.cards.length === 0 ||
                    tile.tileResult.cards.some((raw) => {
                      if (!raw || typeof raw !== "object") return true;
                      const row = raw as Record<string, unknown>;
                      const set = String(row.set ?? "").trim();
                      const number = String(row.number ?? "").trim();
                      const name = String(row.name ?? "").trim();
                      return !name || (!set && !number);
                    }),
                );

              const verifyPriority = (tile: (typeof tileResults)[number]): number => {
                let score = 0;
                if (tile.tileResult.cards.length === 0) score += 100;
                if (tile.tileResult.salvaged) score += 80;
                if (tile.tileResult.compactRetry) score += 60;
                if (tile.tileResult.finishReason === "length") score += 50;
                for (const raw of tile.tileResult.cards) {
                  if (!raw || typeof raw !== "object") {
                    score += 40;
                    continue;
                  }
                  const row = raw as Record<string, unknown>;
                  if (!String(row.name ?? "").trim()) score += 30;
                  if (!String(row.set ?? "").trim()) score += 20;
                  if (!String(row.number ?? "").trim()) score += 20;
                }
                return score;
              };

              const verifyTargets = tileResults
                .filter(tileNeedsVerify)
                .sort((a, b) => verifyPriority(b) - verifyPriority(a))
                .slice(0, verifyCap);

              if (verifyPrompt && verifyCompactPrompt) {
                for (const tile of verifyTargets) {
                  const { result: verified, warnings: verifyWarnings } =
                    await runVerifyPassWithFallback({
                      prompt: verifyPrompt,
                      compactPrompt: verifyCompactPrompt,
                      imageBase64: tile.b64,
                      imageMimeType: tile.tileMime,
                      skippedProviders: skippedSet,
                      timeoutMs,
                    });

                  if (!verified) continue;

                  if (verifyWarnings.length > 0) {
                    errors.push(`verify:${verified.provider}: ${verifyWarnings[0]}`);
                  }

                  const preferVerified =
                    Boolean(
                      tile.tileResult.salvaged ||
                        tile.tileResult.compactRetry ||
                        tile.tileResult.finishReason === "length",
                    ) ||
                    verified.cards.length >= tile.tileResult.cards.length ||
                    visionVerify;

                  if (preferVerified) {
                    tile.tileResult = {
                      ...tile.tileResult,
                      cards: verified.cards,
                      provider: tile.tileResult.provider,
                      salvaged: verified.salvaged || tile.tileResult.salvaged,
                      compactRetry: verified.compactRetry ?? tile.tileResult.compactRetry,
                      finishReason: verified.finishReason ?? tile.tileResult.finishReason,
                    };
                  }
                }
              }

              const merged: unknown[] = [];
              let salvaged = false;
              let compactRetry = false;
              let finishReason: string | null = null;
              for (const { tileIndex, tileResult } of tileResults) {
                salvaged = salvaged || tileResult.salvaged;
                compactRetry = compactRetry || Boolean(tileResult.compactRetry);
                finishReason = tileResult.finishReason ?? finishReason;
                for (const card of tileResult.cards) {
                  merged.push({
                    ...(card as object),
                    sourceTileIndex: tileIndex,
                  });
                }
              }
              return {
                cards: merged,
                provider: providerId,
                salvaged,
                compactRetry,
                finishReason,
              };
            })()
          : runVisionProviderOnce(
              providerId,
              prompt,
              compactPrompt,
              imageBase64s,
              imageMimeTypes,
              {
                allowCompactRetry: true,
                compactDensePrompt,
              },
            ),
        timeoutMs,
        providerId,
      );

      if (result.cards.length === 0) {
        errors.push(`${providerId}: empty extraction`);
        continue;
      }

      const normalized = normalizeCards(result.cards);
      let out =
        singleCardCrop && normalized.length > 1
          ? normalized.slice(0, 1)
          : normalized;
      const warnings = [...errors];
      if (result.salvaged || result.compactRetry) {
        warnings.push(
          `${providerId}: ${result.compactRetry ? "compact retry" : "salvaged"} — ${out.length} card(s); re-scan if incomplete`,
        );
      }
      if (result.finishReason === "length") {
        warnings.push(
          `${providerId}: output hit token limit — some cards may be missing`,
        );
      }

      const shouldRunVerify =
        verifyEligible &&
        Boolean(
          // User explicitly requests the extra verify pass (UI/global).
          visionVerify ||
            // Server-side auto-trigger when primary pass looks suspicious/truncated.
            result.salvaged ||
            result.compactRetry ||
            result.finishReason === "length",
        );

      if (shouldRunVerify && verifyPrompt && verifyCompactPrompt) {
        try {
          const verifyTimeout = Math.min(timeoutMs, 90_000);
          const { result: verified, warnings: verifyWarnings } =
            await runVerifyPassWithFallback({
              prompt: verifyPrompt,
              compactPrompt: verifyCompactPrompt,
              imageBase64: imageBase64s[0]!,
              imageMimeType: imageMimeTypes[0] ?? "image/jpeg",
              skippedProviders: skippedSet,
              timeoutMs: verifyTimeout,
            });

          if (verifyWarnings.length > 0) {
            warnings.push(...verifyWarnings.slice(0, 2));
          }

          if (verified?.cards?.length) {
            const verifiedNormalized = normalizeCards(verified.cards);
            const verifiedOut =
              singleCardCrop && verifiedNormalized.length > 1
                ? verifiedNormalized.slice(0, 1)
                : verifiedNormalized;

            // Prefer verify pass when the initial output was truncated/salvaged,
            // or when verified returns at least as many cards.
            const preferVerified =
              Boolean(result.salvaged || result.compactRetry || result.finishReason === "length") ||
              verifiedOut.length >= out.length;

            if (preferVerified) {
              out = verifiedOut;
              warnings.push(`${verified.provider}: verify pass applied`);
              if (verified.salvaged || verified.compactRetry) {
                warnings.push(
                  `${verified.provider}: verify ${verified.compactRetry ? "compact retry" : "salvaged"} — ${verifiedOut.length} card(s)`,
                );
              }
            } else {
              warnings.push(`${verified.provider}: verify pass ran (kept initial result)`);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          warnings.push(`verify: failed (${msg})`);
        }
      }

      return NextResponse.json({
        cards: out,
        provider: providerId,
        warnings,
        salvaged: result.salvaged,
        compactRetry: result.compactRetry ?? false,
      });
    } catch (err) {
      noteProviderFailure(providerId, err);
      errors.push(formatVisionProviderError(providerId, err));
    }
  }

  return NextResponse.json(
    { error: summarizeVisionFailure(errors), providerErrors: errors },
    { status: 503 },
  );
}
