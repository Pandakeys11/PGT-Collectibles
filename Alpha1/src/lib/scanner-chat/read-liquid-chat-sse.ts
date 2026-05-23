import type { LiquidAskResearch } from "@/lib/scanner-chat/liquid-ask-types";

export type LiquidChatSseHandlers = {
  onText: (chunk: string) => void;
  onNotice?: (message: string, detail?: string) => void;
  onStatus?: (phase: string, message: string) => void;
  onResearch?: (research: LiquidAskResearch) => void;
};

export async function readLiquidChatSse(
  response: Response,
  handlers: LiquidChatSseHandlers | ((chunk: string) => void),
  onNotice?: (message: string, detail?: string) => void,
): Promise<{
  provider?: string;
  hasScanData?: boolean;
  marketAsOf?: string | null;
  researchedAt?: string | null;
  todayUtc?: string | null;
  proTier?: boolean;
  research?: LiquidAskResearch | null;
}> {
  const h: LiquidChatSseHandlers =
    typeof handlers === "function"
      ? { onText: handlers, onNotice }
      : { ...handlers, onNotice: handlers.onNotice ?? onNotice };

  if (!response.ok || !response.body) {
    let err = `Ask failed (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string; detail?: string };
      if (data.error) {
        err = data.detail ? `${data.error}: ${data.detail}` : data.error;
      }
    } catch {
      /* ignore */
    }
    throw new Error(err);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let provider: string | undefined;
  let hasScanData: boolean | undefined;
  let marketAsOf: string | null | undefined;
  let researchedAt: string | null | undefined;
  let todayUtc: string | null | undefined;
  let proTier: boolean | undefined;
  let research: LiquidAskResearch | null | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      let payload: {
        type: string;
        text?: string;
        message?: string;
        phase?: string;
        detail?: string;
        provider?: string;
        hasScanData?: boolean;
        marketAsOf?: string | null;
        researchedAt?: string | null;
        todayUtc?: string | null;
        proTier?: boolean;
        research?: LiquidAskResearch | null;
      };
      try {
        payload = JSON.parse(line.slice(5).trim()) as typeof payload;
      } catch {
        continue;
      }
      if (payload.type === "text" && payload.text) h.onText(payload.text);
      if (payload.type === "status" && payload.message) {
        h.onStatus?.(payload.phase ?? "status", payload.message);
      }
      if (payload.type === "research" && payload.research) {
        research = payload.research;
        h.onResearch?.(payload.research);
      }
      if (payload.type === "notice" && payload.message) {
        h.onNotice?.(payload.message, payload.detail);
      }
      if (payload.type === "done") {
        if (payload.provider) provider = payload.provider;
        if (payload.hasScanData != null) hasScanData = payload.hasScanData;
        if (payload.marketAsOf !== undefined) marketAsOf = payload.marketAsOf;
        if (payload.researchedAt !== undefined) researchedAt = payload.researchedAt;
        if (payload.todayUtc !== undefined) todayUtc = payload.todayUtc;
        if (payload.proTier != null) proTier = payload.proTier;
        if (payload.research !== undefined) {
          research = payload.research;
          if (payload.research) h.onResearch?.(payload.research);
        }
      }
      if (payload.type === "error") {
        throw new Error(
          payload.detail
            ? `${payload.message || "Ask error"}: ${payload.detail}`
            : payload.message || "Ask error",
        );
      }
    }
  }

  return { provider, hasScanData, marketAsOf, researchedAt, todayUtc, proTier, research };
}
