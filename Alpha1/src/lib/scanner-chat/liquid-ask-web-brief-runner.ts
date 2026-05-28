import {
  getLiquidAskWebBriefOrder,
  isAiResearchInCooldown,
} from "@/lib/ai/research-budget";
import {
  isLiquidAskFreeWebBriefConfigured,
  isLiquidAskGroqWebBriefConfigured,
  isLiquidAskProWebBriefConfigured,
  runLiquidAskFreeWebBrief,
  runLiquidAskGroqWebBrief,
  runLiquidAskProWebBrief,
} from "@/lib/scanner-chat/liquid-ask-web-brief";
import { isLiquidAskProResearchEnabled } from "@/lib/scanner-chat/liquid-ask-research-tier";

export type WebBriefResult = {
  markdown: string;
  model: string;
  provider: "gemini" | "groq" | "openrouter";
};

/**
 * One web brief per Ask — tries providers in LIQUID_ASK_WEB_BRIEF_ORDER until success.
 * Default gemini → groq (free Google Search before Groq Compound spend).
 */
export async function runLiquidAskWebBriefWithBudget(
  message: string,
  todayUtc: string,
  options?: { allowPro?: boolean },
): Promise<WebBriefResult | null> {
  const allowPro = options?.allowPro ?? isLiquidAskProResearchEnabled();

  for (const provider of getLiquidAskWebBriefOrder()) {
    if (provider === "gemini") {
      if (!isLiquidAskFreeWebBriefConfigured() || isAiResearchInCooldown("gemini")) continue;
      const brief = await runLiquidAskFreeWebBrief(message, todayUtc);
      if (brief) return { ...brief, provider: "gemini" };
      continue;
    }
    if (provider === "groq") {
      if (!isLiquidAskGroqWebBriefConfigured() || isAiResearchInCooldown("groq")) continue;
      const brief = await runLiquidAskGroqWebBrief(message, todayUtc);
      if (brief) return { ...brief, provider: "groq" };
      continue;
    }
    if (provider === "openrouter" && allowPro) {
      if (!isLiquidAskProWebBriefConfigured() || isAiResearchInCooldown("openrouter")) continue;
      const brief = await runLiquidAskProWebBrief(message, todayUtc);
      if (brief) return { ...brief, provider: "openrouter" };
    }
  }

  return null;
}
