import { NextRequest } from "next/server";
import { completePlainText } from "@/lib/ai/text";
import { buildLocalStructuredBrief } from "@/lib/scan/local-brief";
import { buildNarrationLlmContext } from "@/lib/scan/narration-context";
import { briefToMarkdown, parseStructuredBriefFromLlm } from "@/lib/scan/parse-structured-brief";
import { scanCardContextSchema, structuredBriefSchema } from "@/lib/scan/schemas";

const NARRATION_SYSTEM = `You are a senior Pokémon TCG market analyst writing a **research desk brief** for a collector.

Rules:
- Use ONLY facts in the JSON context. Never invent prices, URLs, dates, populations, or comps.
- marketEvidence in your output must be copied from context rows (subset ok); do not fabricate titles or prices.
- Hubs are in marketSourceLinks — do not paste URLs in nextChecks.

Return a single JSON object with keys:
summary, marketSnapshot, compAnalysis, verification, gradedSupply, marketEvidence, valuation, nextChecks

Field guide:
- summary: 3–4 sentences — identity, lane (raw/graded), verification state, top takeaway.
- marketSnapshot: 2–3 sentences — FMV basis, sticker/ask vs FMV, what current in-session comps imply.
- compAnalysis: 3–5 short bullets or one tight paragraph grouping sold vs active vs reference rows by price and date.
- verification: same shape as context.verificationFields (field, extracted, verified, status).
- gradedSupply: population/registry note from context or null.
- marketEvidence: up to 8 rows from context (preserve kind, title, priceUsd, observedAt, source, slab).
- valuation: 2–3 sentences — pricing thesis grounded in FMV and comps.
- nextChecks: 3–5 imperative actions (no URLs).`;

function chunkTextForSse(text: string, size = 240): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    parts.push(text.slice(i, i + size));
  }
  return parts.length > 0 ? parts : [""];
}

export async function POST(req: NextRequest) {
  let body: { context?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = scanCardContextSchema.safeParse(body.context);
  if (!parsed.success) {
    return Response.json({ error: "Invalid scan context" }, { status: 400 });
  }

  const context = parsed.data;
  const llmContext = buildNarrationLlmContext(context);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const result = await completePlainText(
          NARRATION_SYSTEM,
          JSON.stringify(llmContext),
          { json: true },
        );

        let structured = null as ReturnType<typeof structuredBriefSchema.safeParse> | null;
        let provider = "local";
        let streamText = "";

        if (result.ok) {
          provider = result.provider;
          streamText = result.text;
          structured = parseStructuredBriefFromLlm(result.text, context);
        }

        if (!structured?.success) {
          const fallback = buildLocalStructuredBrief(context);
          structured = structuredBriefSchema.safeParse(fallback);
          if (!result.ok) {
            send({
              type: "notice",
              message:
                "Live LLM unavailable — showing a **research brief from your session data** (extraction + market enrich). Free tier: set `FREE_TIER_ONLY=1`, `TEXT_PROVIDER_ORDER=groq,openrouter,gemini`, and skip exhausted providers via `TEXT_SKIP_PROVIDERS` (see `.env.example`).",
              detail: result.cause ?? result.error,
            });
          } else if (result.ok) {
            send({
              type: "notice",
              message:
                "LLM returned invalid JSON — showing the **offline research brief** from session data. Try Refresh or a different text model.",
              detail: result.text.slice(0, 400),
            });
          }
        }

        if (structured?.success) {
          const markdown = briefToMarkdown(structured.data);
          for (const part of chunkTextForSse(markdown)) {
            send({ type: "text", text: part });
          }
          send({ type: "structured", payload: structured.data });
        } else if (streamText) {
          for (const part of chunkTextForSse(streamText)) {
            send({ type: "text", text: part });
          }
        } else {
          send({
            type: "error",
            message: "Unable to build specimen brief",
            detail: result.ok ? undefined : result.cause,
          });
        }

        send({ type: "done", provider });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
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
    },
  });
}
