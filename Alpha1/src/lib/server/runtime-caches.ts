/** In-memory server caches (enrich, Pokédex API responses). Cleared on scan reset / Clear session. */

import { clearProviderCooldowns } from "@/lib/ai/vision-providers";

const clearHandlers = new Set<() => void>();

export function registerRuntimeCacheClear(handler: () => void): void {
  clearHandlers.add(handler);
}

export function flushAllRuntimeCaches(): void {
  for (const handler of Array.from(clearHandlers)) {
    try {
      handler();
    } catch {
      // Best-effort — one failing handler must not block the rest.
    }
  }
}

registerRuntimeCacheClear(clearProviderCooldowns);
