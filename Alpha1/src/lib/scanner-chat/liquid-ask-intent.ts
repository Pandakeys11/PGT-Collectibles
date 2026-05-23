/** Heuristics for when Liquid Ask should pull live market data before answering. */
export function messageWantsLiveMarket(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /\b(fmv|fair\s*market|market\s*value|worth|price|priced|value|comps?|comparable)\b/.test(m) ||
    /\b(sold|listing|listings|ask|asking|auction|ebay)\b/.test(m) ||
    (/\b(current|today|now|recent|latest|updated|live)\b/.test(m) &&
      /\b(market|price|worth|value|comps?)\b/.test(m)) ||
    /\bhow\s+much\b/.test(m) ||
    /\bwhat('s| is) it worth\b/.test(m) ||
    /\btrend(ing)?\b/.test(m)
  );
}

/** Ranking / set / chase questions that need web research, not upload tutorials. */
export function messageNeedsWebResearch(message: string): boolean {
  const m = message.toLowerCase();
  return (
    messageWantsLiveMarket(message) ||
    /\b(highest|top|most|best|expensive|cheapest|grail|chase|#1|number one)\b/.test(m) ||
    /\b(which|what).{0,48}\b(card|slab|hit|pull)\b/.test(m) ||
    (/\b(base set|jungle|fossil|expansion|booster|set)\b/.test(m) &&
      /\b(card|value|worth|price|expensive|valuable)\b/.test(m))
  );
}

export function messageMentionsCert(message: string): boolean {
  return /\b(psa|bgs|cgc|sgc|tag)\s*#?\s*\d{6,}\b/i.test(message) || /\bcert(ificate)?\s*#?\s*\d{6,}\b/i.test(message);
}

/** Skip live research for greetings / ultra-short prompts. */
export function isSubstantiveAsk(message: string): boolean {
  const t = message.trim();
  if (t.length < 10) return false;
  if (/^(hi|hello|hey|thanks|thank you|ok|okay)\b[!.?\s]*$/i.test(t)) return false;
  return true;
}

/** Default: run live research for real questions (ChatGPT-style), not only when a scan is loaded. */
export function shouldRunLiveResearch(message: string, contextCount: number): boolean {
  return (
    isSubstantiveAsk(message) &&
    (messageNeedsWebResearch(message) ||
      messageMentionsCert(message) ||
      contextCount > 0)
  );
}
