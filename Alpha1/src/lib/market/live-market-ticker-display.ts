import type {
  LiveMarketTickerLane,
  LiveMarketTickerLaneId,
  LiveMarketTickerSlide,
} from "@/lib/market/live-market-ticker-types";
import { LIVE_MARKET_TICKER_LANE_ORDER } from "@/lib/market/live-market-ticker-types";

/** Stagger secondary lanes through the set tour. */
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

/** Display price available for banner / pill UI. */
export function slideBannerPriceUsd(slide: LiveMarketTickerSlide): number | null {
  const candidates = [slide.rawFmvUsd, slide.priceUsd, slide.tcgMarketUsd, slide.psa10FmvUsd];
  for (const n of candidates) {
    if (n != null && Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Core market pulse card — needs a price and card title. */
export function slideHasBannerData(slide: LiveMarketTickerSlide): boolean {
  return Boolean(slide.cardName?.trim()) && slideBannerPriceUsd(slide) != null;
}

function pickFromLaneSpread(
  lane: LiveMarketTickerLane,
  slides: LiveMarketTickerSlide[],
  tick: number,
  slot: number,
  slots: number,
  usedSets: Set<string>,
  usedCards: Set<string>,
): LiveMarketBannerPill | null {
  const len = slides.length;
  if (len === 0) return null;

  const stride = Math.max(1, Math.floor(len / slots));
  const start = (((tick + slot * stride) % len) + len) % len;

  for (let attempt = 0; attempt < len; attempt += 1) {
    const index = (start + attempt) % len;
    const slide = slides[index]!;
    const key = slideKey(slide);
    if (usedCards.has(key)) continue;
    if (usedSets.has(slide.setId)) continue;
    usedCards.add(key);
    usedSets.add(slide.setId);
    const fullIndex = lane.slides.findIndex(
      (s) => s.setId === slide.setId && s.catalogId === slide.catalogId,
    );
    return {
      laneId: lane.id,
      lane,
      slide,
      index: fullIndex >= 0 ? fullIndex : index,
    };
  }

  for (let attempt = 0; attempt < len; attempt += 1) {
    const index = (start + attempt) % len;
    const slide = slides[index]!;
    const key = slideKey(slide);
    if (usedCards.has(key)) continue;
    usedCards.add(key);
    usedSets.add(slide.setId);
    const fullIndex = lane.slides.findIndex(
      (s) => s.setId === slide.setId && s.catalogId === slide.catalogId,
    );
    return {
      laneId: lane.id,
      lane,
      slide,
      index: fullIndex >= 0 ? fullIndex : index,
    };
  }

  return null;
}

/** Primary: three top-value highlights (one per set slice). Fallback: mixed lanes. */
function pickTopValueBannerPills(
  tick: number,
  lanes: LiveMarketTickerLane[],
): LiveMarketBannerPill[] {
  const lane = lanes.find((l) => l.id === "top_value");
  if (!lane?.slides.length) return [];

  const eligible = lane.slides.filter(slideHasBannerData);
  if (eligible.length === 0) return [];

  const slots = Math.min(3, eligible.length);
  const usedSets = new Set<string>();
  const usedCards = new Set<string>();
  const out: LiveMarketBannerPill[] = [];

  for (let slot = 0; slot < slots; slot += 1) {
    const picked = pickFromLaneSpread(
      lane,
      eligible,
      tick,
      slot,
      slots,
      usedSets,
      usedCards,
    );
    if (picked) out.push(picked);
  }

  return out;
}

function bannerLaneIds(lanes: LiveMarketTickerLane[]): LiveMarketTickerLaneId[] {
  const order: LiveMarketTickerLaneId[] = [...LIVE_MARKET_TICKER_LANE_ORDER];
  const jpn = lanes.find((l) => l.id === "jpn_art");
  if (!jpn?.slides.length) {
    const idx = order.indexOf("jpn_art");
    if (idx >= 0) order[idx] = "spotlight";
  }
  return order;
}

function pickMixedLaneBannerPills(
  tick: number,
  lanes: LiveMarketTickerLane[],
): LiveMarketBannerPill[] {
  const out: LiveMarketBannerPill[] = [];
  const usedCards = new Set<string>();
  const usedSets = new Set<string>();

  for (const laneId of bannerLaneIds(lanes)) {
    const lane = lanes.find((l) => l.id === laneId);
    if (!lane?.slides.length) continue;

    const eligible =
      laneId === "top_value"
        ? lane.slides.filter(slideHasBannerData)
        : lane.slides;
    if (!eligible.length) continue;

    const len = eligible.length;
    const shift = Math.floor(len * LANE_SHIFT_RATIO[laneId]);
    const start = (((tick + shift) % len) + len) % len;

    let picked: LiveMarketBannerPill | null = null;
    for (let attempt = 0; attempt < len; attempt += 1) {
      const index = (start + attempt) % len;
      const slide = eligible[index]!;
      const key = slideKey(slide);
      if (usedCards.has(key)) continue;
      if (usedSets.has(slide.setId)) continue;
      const fullIndex = lane.slides.findIndex(
        (s) => s.setId === slide.setId && s.catalogId === slide.catalogId,
      );
      picked = { laneId, lane, slide, index: fullIndex >= 0 ? fullIndex : index };
      break;
    }

    if (!picked) {
      for (let attempt = 0; attempt < len; attempt += 1) {
        const index = (start + attempt) % len;
        const slide = eligible[index]!;
        const key = slideKey(slide);
        if (usedCards.has(key)) continue;
        const fullIndex = lane.slides.findIndex(
          (s) => s.setId === slide.setId && s.catalogId === slide.catalogId,
        );
        picked = { laneId, lane, slide, index: fullIndex >= 0 ? fullIndex : index };
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

export function pickBannerTriplet(tick: number, lanes: LiveMarketTickerLane[]): LiveMarketBannerPill[] {
  const topValue = pickTopValueBannerPills(tick, lanes);
  if (topValue.length >= 3) return topValue;
  if (topValue.length >= 1) {
    const mixed = pickMixedLaneBannerPills(tick, lanes);
    const seen = new Set(topValue.map((p) => slideKey(p.slide)));
    for (const pill of mixed) {
      if (topValue.length >= 3) break;
      if (seen.has(slideKey(pill.slide))) continue;
      topValue.push(pill);
      seen.add(slideKey(pill.slide));
    }
    if (topValue.length > 0) return topValue;
  }
  return pickMixedLaneBannerPills(tick, lanes);
}

export function maxLaneLength(lanes: LiveMarketTickerLane[]): number {
  const topValue = lanes.find((l) => l.id === "top_value");
  const eligible = topValue?.slides.filter(slideHasBannerData).length ?? 0;
  if (eligible > 0) return eligible;
  return Math.max(0, ...lanes.map((l) => l.slides.length));
}
