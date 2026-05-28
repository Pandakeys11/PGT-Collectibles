import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth/app-user";
import { isProTierPlan } from "@/lib/auth/plans";
import { streamPlainText } from "@/lib/ai/text";
import {
  getGroqTextMaxTokensReport,
  getLiquidAskMaxTokens,
  getOpenRouterApiKey,
  getTextProviderOrder,
  getTextSkipProviders,
  isFreeTierOnly,
  isGroqPrimaryOnly,
  isLiquidAskGeminiResearchEnabled,
  isScanAutoReportEnabled,
} from "@/lib/ai/env";
import {
  isLiquidAskFreeWebBriefConfigured,
  isLiquidAskProWebBriefConfigured,
} from "@/lib/scanner-chat/liquid-ask-web-brief";
import {
  LIQUID_ASK_FREE_RESEARCH_STEPS,
  LIQUID_ASK_PRO_RESEARCH_STEPS,
} from "@/lib/scanner-chat/liquid-ask-research-tier";
import { getMarketCapabilities, marketCapabilitiesSummary } from "@/lib/market/market-capabilities";
import { buildLiquidChatPayload } from "@/lib/scanner-chat/liquid-chat-context";
import {
  buildLiquidScanReportUserPrompt,
  buildScanReportResearchQuery,
  LIQUID_SCAN_REPORT_SYSTEM,
} from "@/lib/scanner-chat/liquid-scan-report";
import { deriveLiquidAskConfidenceHints } from "@/lib/scanner-chat/liquid-ask-confidence";
import {
  liquidAskResearchForLlm,
  runLiquidAskResearch,
} from "@/lib/scanner-chat/liquid-ask-research";
import { sanitizeScanCardContextInput } from "@/lib/scanner-chat/sanitize-liquid-chat-context";
import type { LiquidAskResearch } from "@/lib/scanner-chat/liquid-ask-types";
import { scanCardContextSchema } from "@/lib/scan/schemas";

const MAX_MESSAGE_CHARS = 2_000;
const MAX_HISTORY_TURNS = 8;
const bodySchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(MAX_MESSAGE_CHARS),
      }),
    )
    .max(MAX_HISTORY_TURNS)
    .optional()
    .default([]),
  contexts: z.array(scanCardContextSchema).max(24).optional().default([]),
  focusSpecimenId: z.string().optional().nullable(),
  reportMode: z.enum(["scan_report"]).optional(),
});

function parseContexts(raw: unknown): z.infer<typeof bodySchema>["contexts"] {
  if (!Array.isArray(raw)) return [];
  const parsed: z.infer<typeof bodySchema>["contexts"] = [];
  for (const item of raw) {
    const sanitized = sanitizeScanCardContextInput(item);
    const result = scanCardContextSchema.safeParse(sanitized);
    if (result.success) parsed.push(result.data);
  }
  return parsed;
}

/** Quick health check for Liquid Scan Ask / text provider chain. */
export async function GET() {
  await auth.protect();
  const order = getTextProviderOrder().filter((id) => !getTextSkipProviders().includes(id));
  const market = getMarketCapabilities();
  return Response.json({
    ok: order.length > 0,
    textProviders: order,
    market,
    marketSummary: marketCapabilitiesSummary(market),
    research: {
      free: {
        steps: [...LIQUID_ASK_FREE_RESEARCH_STEPS],
        geminiBrief: isLiquidAskFreeWebBriefConfigured(),
      },
      pro: {
        steps: [...LIQUID_ASK_PRO_RESEARCH_STEPS],
        sonarBrief: isLiquidAskProWebBriefConfigured(),
        openRouterKey: Boolean(getOpenRouterApiKey()),
      },
    },
    freeTierOnly: isFreeTierOnly(),
    groqPrimaryOnly: isGroqPrimaryOnly(),
    scanAutoReport: isScanAutoReportEnabled(),
    geminiAskResearch: isLiquidAskGeminiResearchEnabled(),
    hint:
      order.length === 0
        ? "Configure OPENAI_API_KEY, GROQ_API_KEY, XAI_API_KEY, and/or OPENROUTER_API_KEY; check TEXT_SKIP_PROVIDERS and FREE_TIER_ONLY."
        : "POST with { message, history?, contexts?, focusSpecimenId? } for SSE Ask. Set OPENROUTER_API_KEY + OPENROUTER_MARKET_MODEL (e.g. perplexity/sonar) for open-web answers without a scan.",
  });
}

export async function POST(req: NextRequest) {
  await auth.protect();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const contexts = parseContexts(rawBody.contexts);

  const parsed = bodySchema.safeParse({
    ...rawBody,
    contexts,
  });
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request",
        detail: parsed.error.issues.slice(0, 3).map((i) => i.message).join("; "),
      },
      { status: 400 },
    );
  }

  const { message, history, focusSpecimenId, reportMode } = parsed.data;
  const isScanReport = reportMode === "scan_report";

  const appUser = await getCurrentAppUser();
  const proTier = appUser ? isProTierPlan(appUser.plan) : false;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      let research: LiquidAskResearch | null = null;

      try {
        send({
          type: "status",
          phase: "research",
          message: isScanReport
            ? "Researching market sentiment & hype…"
            : "Searching current market data…",
        });

        const researchMessage = isScanReport
          ? buildScanReportResearchQuery(
              contexts,
              {
                totalDetected: contexts.length,
                highConfidence: contexts.filter(
                  (c) => c.catalogIdentityStatus === "confirmed",
                ).length,
                needsReview: contexts.filter(
                  (c) =>
                    c.catalogIdentityStatus === "ambiguous" ||
                    c.verificationStatus !== "verified",
                ).length,
                estimatedTotal: contexts.reduce(
                  (sum, c) => sum + (c.fairValueUsd ?? 0),
                  0,
                ),
                bestHit: undefined,
              },
            )
          : message;

        try {
          research = await runLiquidAskResearch({
            message: researchMessage,
            contexts,
            focusSpecimenId: isScanReport ? null : focusSpecimenId,
            proTier,
          });
        } catch (err) {
          console.error("[liquid-chat] research failed", err);
          research = null;
        }

        if (research) {
          send({ type: "research", research });
          const ebay = research.dataCoverage.ebaySoldCount;
          send({
            type: "status",
            phase: "answer",
            message:
              ebay > 0
                ? `eBay: ${ebay} sold comp(s) · ${research.hubLinks.length} platform link(s) — writing answer…`
                : `Found ${research.comps.length} comp(s) — writing answer…`,
          });
        } else {
          send({
            type: "status",
            phase: "answer",
            message: "Writing answer…",
          });
        }

        const researchJson = research ? liquidAskResearchForLlm(research) : null;

        let system: string;
        let user: string;
        let hasScanData: boolean;
        let marketAsOf: string | null;

        if (isScanReport) {
          const summary = {
            totalDetected: contexts.length,
            highConfidence: contexts.filter(
              (c) => c.catalogIdentityStatus === "confirmed",
            ).length,
            needsReview: contexts.filter(
              (c) =>
                c.catalogIdentityStatus === "ambiguous" ||
                c.verificationStatus !== "verified",
            ).length,
            estimatedTotal: Math.round(
              contexts.reduce((sum, c) => sum + (c.fairValueUsd ?? 0), 0),
            ),
            bestHit: (() => {
              const top = [...contexts].sort(
                (a, b) => (b.fairValueUsd ?? 0) - (a.fairValueUsd ?? 0),
              )[0];
              return top?.fairValueUsd
                ? { name: top.name, fmv: Math.round(top.fairValueUsd) }
                : undefined;
            })(),
          };
          system = LIQUID_SCAN_REPORT_SYSTEM;
          user = buildLiquidScanReportUserPrompt({
            contexts,
            summary,
            researchJson,
          });
          hasScanData = contexts.length > 0;
          marketAsOf =
            contexts.map((c) => c.marketAsOf).filter(Boolean).sort().at(-1) ?? null;
        } else {
          const payload = buildLiquidChatPayload({
            message,
            history,
            contexts,
            focusSpecimenId,
            researchJson,
            research,
          });
          system = payload.system;
          user = payload.user;
          hasScanData = payload.hasScanData;
          marketAsOf = payload.marketAsOf;
        }

        const textStream = await streamPlainText(system, user, {
          maxTokens: isScanReport
            ? getGroqTextMaxTokensReport()
            : getLiquidAskMaxTokens(),
        });
        let provider = "unknown";
        for await (const event of textStream) {
          if (event.type === "chunk") {
            send({ type: "text", text: event.text });
          } else if (event.type === "done") {
            provider = event.provider;
            const focusCtx =
              focusSpecimenId != null
                ? contexts.find((c) => c.specimenId === focusSpecimenId) ?? null
                : null;
            const confidenceHints = !isScanReport
              ? deriveLiquidAskConfidenceHints({
                  research,
                  focus: focusCtx,
                  contextCount: contexts.length,
                })
              : null;
            send({
              type: "done",
              provider,
              hasScanData,
              marketAsOf: research?.researchedAt ?? marketAsOf,
              researchedAt: research?.researchedAt ?? null,
              todayUtc: research?.todayUtc ?? null,
              proTier,
              research,
              confidenceHints,
            });
          } else if (event.type === "error") {
            send({
              type: "error",
              message: event.message,
              detail: event.cause,
            });
            controller.close();
            return;
          }
        }
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Ask failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
