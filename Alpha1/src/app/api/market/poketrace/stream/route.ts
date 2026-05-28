import { NextRequest } from "next/server";
import { isPokeTraceWsEnabled } from "@/lib/market/env-market";
import { listPokeTraceRealtimeUpdates } from "@/lib/market/poketrace/realtime-store";
import { ensurePokeTraceWsBridge, getPokeTraceWsStatus } from "@/lib/market/poketrace/ws-bridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 4_000;

export async function GET(req: NextRequest) {
  if (!isPokeTraceWsEnabled()) {
    return new Response("PokeTrace WebSocket disabled\n", { status: 503 });
  }

  ensurePokeTraceWsBridge();

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const push = () => {
        if (closed) return;
        const updates = listPokeTraceRealtimeUpdates(80);
        const ws = getPokeTraceWsStatus();
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ updates, ws, at: new Date().toISOString() })}\n\n`,
          ),
        );
      };

      push();
      const timer = setInterval(push, POLL_MS);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(timer);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
