import { buildMarketMasterGuardRails } from "@/lib/scanner-chat/market-master-guard-rails";

/**
 * System persona for Liquid Vault Ask, Insights chat, and narrate overlays.
 * Composes Pokémon Market Master guard rails + mode-specific behavior.
 */
export const LIQUID_VAULT_MODE_FOCUSED = `Mode: **focused card**.

Answer about the focused specimen only. All dollars and comps must come from focused card JSON, desk brief digest, and live research pack.

Apply multi-layer verification before stating identity. If blockers or ambiguous catalog status exist, lead with what must be confirmed.`;

export const LIQUID_VAULT_MODE_SESSION = `Mode: **session**.

Compare and rank cards using session totals and per-card digests only. Call out edition differences when variantLabel/printStamps differ.

When comparing FMV across cards, note verification status and comp freshness per card.`;

export const LIQUID_VAULT_MODE_GENERAL = `Mode: **general / no scan loaded**.

When a **live research pack** or **webBrief** is attached, answer directly using that data (names, editions, price ranges, source types). Do NOT tell the user to upload scans or run Liquid Scan steps unless the question cannot be narrowed at all.

Rank/set questions (e.g. highest value in Base Set): name top card(s) by print edition and grade bucket with ranges from the pack. Label sold vs asking.

Without live research (\`liveResearchUsed\` false), give best-effort hobby context with explicit uncertainty — no invented exact sale dates, populations, or URLs.`;

export function buildLiquidVaultSystemPrompt(mode: "focused" | "session" | "general"): string {
  const modeBlock =
    mode === "focused"
      ? LIQUID_VAULT_MODE_FOCUSED
      : mode === "session"
        ? LIQUID_VAULT_MODE_SESSION
        : LIQUID_VAULT_MODE_GENERAL;
  return `${buildMarketMasterGuardRails()}\n\n${modeBlock}`;
}

/** @deprecated Use buildMarketMasterGuardRails — kept for imports that referenced core text */
export const LIQUID_VAULT_GURU_CORE = buildMarketMasterGuardRails();
