import { NextRequest } from "next/server";
import { completePlainText } from "@/lib/ai/text";
import { buildNarrationLlmContext } from "@/lib/scan/narration-context";
import { scanCardContextSchema } from "@/lib/scan/schemas";

const MAX_MESSAGE_CHARS = 2_000;
const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 12_000;

export async function POST(req: NextRequest) {
  let body: {
    context?: unknown;
    message?: string;
    history?: Array<{ role: string; content: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = scanCardContextSchema.safeParse(body.context);
  if (!parsed.success) {
    return Response.json({ error: "Invalid scan context" }, { status: 400 });
  }
  const message = String(body.message ?? "").trim();
  if (!message) {
    return Response.json({ error: "message required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return Response.json(
      { error: `message must be ${MAX_MESSAGE_CHARS} characters or fewer` },
      { status: 413 },
    );
  }

  const history = Array.isArray(body.history)
    ? body.history.slice(-MAX_HISTORY_TURNS)
    : [];
  const transcript = history
    .map((turn) => {
      const role = turn.role === "assistant" ? "assistant" : "user";
      return `${role}: ${String(turn.content ?? "").slice(0, MAX_MESSAGE_CHARS)}`;
    })
    .concat(`user: ${message}`)
    .join("\n");
  if (transcript.length > MAX_HISTORY_CHARS) {
    return Response.json(
      { error: "conversation is too large" },
      { status: 413 },
    );
  }

  const compactContext = buildNarrationLlmContext(parsed.data);
  const result = await completePlainText(
    "You are a Pokémon TCG research assistant. Answer using only the specimen context JSON. Be concise, cite FMV/comps/verification fields, and do not invent prices or URLs.",
    `Context:\n${JSON.stringify(compactContext)}\n\nConversation:\n${transcript}`,
  );

  if (!result.ok) {
    return Response.json(
      { error: result.error, detail: result.cause },
      { status: 503 },
    );
  }

  return Response.json({ text: result.text, provider: result.provider });
}
