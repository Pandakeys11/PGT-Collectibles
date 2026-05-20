import { NextRequest } from "next/server";
import { completePlainText } from "@/lib/ai/text";
import { buildNarrationLlmContext } from "@/lib/scan/narration-context";
import {
  buildSessionBrief,
  NARRATION_SYSTEM,
  parseNarrationBriefFromLlm,
} from "@/lib/scan/narration-brief";
import { briefToMarkdown } from "@/lib/scan/parse-structured-brief";
import { scanCardContextSchema } from "@/lib/scan/schemas";

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
  const sessionBrief = buildSessionBrief(context);
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

        let brief = sessionBrief;
        let provider = "session";

        if (result.ok) {
          const llmBrief = parseNarrationBriefFromLlm(result.text, context, sessionBrief);
          if (llmBrief.ok) {
            brief = llmBrief.brief;
            provider = llmBrief.source === "llm" ? result.provider : `${result.provider}+session`;
            if (llmBrief.salvaged) {
              send({
                type: "notice",
                level: "info",
                message:
                  "Brief uses your **session comps and FMV**; the model narrative was partially trimmed and merged with verified session fields.",
              });
            }
          } else {
            send({
              type: "notice",
              level: "info",
              message:
                "Brief built from **your session data** (catalog match, FMV, and in-session comps). The text model did not return usable JSON.",
              detail: result.text.slice(0, 280),
            });
          }
        } else {
          send({
            type: "notice",
            level: "info",
            message:
              "Brief built from **your session data** (extraction + market enrich). Configure `GROQ_API_KEY` or `OPENROUTER_API_KEY` for an optional AI narrative layer.",
            detail: result.cause ?? result.error,
          });
        }

        const markdown = briefToMarkdown(brief);
        for (const part of chunkTextForSse(markdown)) {
          send({ type: "text", text: part });
        }
        send({ type: "structured", payload: brief });
        send({ type: "done", provider });
      } catch (err) {
        const markdown = briefToMarkdown(sessionBrief);
        for (const part of chunkTextForSse(markdown)) {
          send({ type: "text", text: part });
        }
        send({ type: "structured", payload: sessionBrief });
        send({
          type: "notice",
          level: "info",
          message: "Brief built from session data after an unexpected error.",
          detail: err instanceof Error ? err.message : String(err),
        });
        send({ type: "done", provider: "session" });
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
