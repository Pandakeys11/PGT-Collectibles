/** In-process cooldown after PokeTrace 429 (avoids hammering during set insight hydrate). */

let rateLimitedUntilMs = 0;
let lastMessage: string | null = null;

export function isPokeTraceRateLimited(): boolean {
  return Date.now() < rateLimitedUntilMs;
}

export function pokeTraceRateLimitMessage(): string | null {
  if (!isPokeTraceRateLimited()) return null;
  return lastMessage;
}

export function markPokeTraceRateLimited(resetsAt?: string | null): void {
  const parsed = resetsAt ? Date.parse(resetsAt) : NaN;
  rateLimitedUntilMs = Number.isFinite(parsed)
    ? parsed
    : Date.now() + 6 * 60 * 60 * 1000;
  lastMessage =
    resetsAt != null
      ? `PokeTrace daily limit reached — resets ${resetsAt}`
      : "PokeTrace daily API limit reached — movers use catalog Cardmarket until reset";
}

export function clearPokeTraceRateLimitForTests(): void {
  rateLimitedUntilMs = 0;
  lastMessage = null;
}
