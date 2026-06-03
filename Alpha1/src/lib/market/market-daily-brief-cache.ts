import {
  getMarketDailyBriefEditionKey,
  getMarketDailyBriefNextRefreshAt,
  getMarketDailyBriefRefreshHourUtc,
} from "@/lib/market/market-daily-brief-schedule";
import {
  runMarketDailyBrief,
  type MarketDailyBriefPayload,
} from "@/lib/market/run-market-daily-brief";
import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";

type DailyCache = { editionKey: string; body: MarketDailyBriefPayload };
let cache: DailyCache | null = null;
let buildInFlight: Promise<MarketDailyBriefPayload> | null = null;

registerRuntimeCacheClear(() => {
  cache = null;
  buildInFlight = null;
});

function attachScheduleMeta(body: MarketDailyBriefPayload): MarketDailyBriefPayload {
  const editionKey = getMarketDailyBriefEditionKey();
  return {
    ...body,
    editionKey,
    nextRefreshAt: getMarketDailyBriefNextRefreshAt(),
    refreshHourUtc: getMarketDailyBriefRefreshHourUtc(),
  };
}

export function getCachedMarketDailyBrief(): MarketDailyBriefPayload | null {
  const editionKey = getMarketDailyBriefEditionKey();
  if (cache?.editionKey === editionKey && (cache.body.ready || cache.body.markdown)) {
    return attachScheduleMeta(cache.body);
  }
  return null;
}

export async function ensureMarketDailyBrief(
  refresh = false,
): Promise<MarketDailyBriefPayload> {
  const editionKey = getMarketDailyBriefEditionKey();

  if (!refresh && cache?.editionKey === editionKey && cache.body.ready) {
    return attachScheduleMeta(cache.body);
  }

  if (buildInFlight) return buildInFlight;

  buildInFlight = runMarketDailyBrief(editionKey)
    .then((body) => {
      if (body.ready || body.markdown) {
        cache = { editionKey, body };
      }
      return attachScheduleMeta(body);
    })
    .finally(() => {
      buildInFlight = null;
    });

  return buildInFlight;
}
