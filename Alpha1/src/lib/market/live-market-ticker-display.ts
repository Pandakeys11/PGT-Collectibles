import type {
  LiveMarketTickerLane,
  LiveMarketTickerLaneId,
  LiveMarketTickerSlide,
} from "@/lib/market/live-market-ticker-types";
import { LIVE_MARKET_TICKER_LANE_ORDER } from "@/lib/market/live-market-ticker-types";

/** Stagger each lane through the set tour so pills land on different eras at once. */
const LANE_SHIFT_RATIO: Record<LiveMarketTickerLaneId, number> = {
  top_value: 0,
  momentum: 1 / 3,
  spotlight: 2 / 3,
  jpn_art: 2 / 3,
};

function slideKey(slide: LiveMarketTickerSlide): string {
  return `${slide.setId}:${slide.catalogId}`;
}

export type LiveMarketBannerPill = {
  laneId: LiveMarketTickerLaneId;
  lane: LiveMarketTickerLane;
  slide: LiveMarketTickerSlide;
  index: number;
};

/**
 * Pick three pills that differ by set (and card when possible) for the composer banner.
 */
function bannerLaneIds(lanes: LiveMarketTickerLane[]): LiveMarketTickerLaneId[] {
  const order: LiveMarketTickerLaneId[] = [...LIVE_MARKET_TICKER_LANE_ORDER];
  const jpn = lanes.find((l) => l.id === "jpn_art");
  if (!jpn?.slides.length) {
    const idx = order.indexOf("jpn_art");
    if (idx >= 0) order[idx] = "spotlight";
  }
  return order;
}

export function pickBannerTriplet(tick: number, lanes: LiveMarketTickerLane[]): LiveMarketBannerPill[] {
  const out: LiveMarketBannerPill[] = [];
  const usedCards = new Set<string>();
  const usedSets = new Set<string>();

  for (const laneId of bannerLaneIds(lanes)) {
    const lane = lanes.find((l) => l.id === laneId);
    if (!lane?.slides.length) continue;

    const len = lane.slides.length;
    const shift = Math.floor(len * LANE_SHIFT_RATIO[laneId]);
    const start = (((tick + shift) % len) + len) % len;

    let picked: LiveMarketBannerPill | null = null;
    for (let attempt = 0; attempt < len; attempt += 1) {
      const index = (start + attempt) % len;
      const slide = lane.slides[index]!;
      const key = slideKey(slide);

      if (usedCards.has(key)) continue;
      if (usedSets.has(slide.setId)) continue;

      picked = { laneId, lane, slide, index };
      break;
    }

    // Relax set uniqueness only if we could not fill all three
    if (!picked) {
      for (let attempt = 0; attempt < len; attempt += 1) {
        const index = (start + attempt) % len;
        const slide = lane.slides[index]!;
        const key = slideKey(slide);
        if (usedCards.has(key)) continue;
        picked = { laneId, lane, slide, index };
        break;
      }
    }

    if (picked) {
      usedCards.add(slideKey(picked.slide));
      usedSets.add(picked.slide.setId);
      out.push(picked);
    }
  }

  return out;
}

export function maxLaneLength(lanes: LiveMarketTickerLane[]): number {
  return Math.max(0, ...lanes.map((l) => l.slides.length));
}
