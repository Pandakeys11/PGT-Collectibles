import type { VisionGridLocation } from "@/lib/scan/spatial";

/** Normalized tile bounds on the parent image (0–1). */
export type BinderGridTile = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type BinderGridTilePlan = {
  rows: number;
  cols: number;
  tiles: BinderGridTile[];
};

/**
 * Tile a flat-lay so each crop has ~3–5 cards (e.g. 4×5 table shots → 2×4 tiles).
 * Overlap reduces cards clipped on tile edges.
 */
export function planBinderGridTiles(
  naturalWidth: number,
  naturalHeight: number,
): BinderGridTilePlan {
  const aspect = naturalWidth / Math.max(1, naturalHeight);
  const overlap = 0.12;
  let rows: number;
  let cols: number;
  if (aspect >= 1.35) {
    // Wide flat lay (typical 4×5 or 5×4 table photos).
    rows = 2;
    cols = 4;
  } else if (aspect >= 1.05) {
    rows = 2;
    cols = 3;
  } else if (aspect >= 0.85) {
    rows = 3;
    cols = 3;
  } else {
    // Tall phone photo of a portrait-oriented grid.
    rows = 4;
    cols = 2;
  }
  const tiles: BinderGridTile[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cellH = 1 / rows;
      const cellW = 1 / cols;
      const top = Math.max(0, row * cellH - (row > 0 ? overlap * cellH : 0));
      const left = Math.max(0, col * cellW - (col > 0 ? overlap * cellW : 0));
      const bottom = Math.min(
        1,
        (row + 1) * cellH + (row < rows - 1 ? overlap * cellH : 0),
      );
      const right = Math.min(
        1,
        (col + 1) * cellW + (col < cols - 1 ? overlap * cellW : 0),
      );
      tiles.push({
        top,
        left,
        width: right - left,
        height: bottom - top,
      });
    }
  }

  return { rows, cols, tiles };
}

export function readImageNaturalSize(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return loadImageElement(dataUrl).then((img) => ({
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  }));
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/** Crop a normalized tile from a data URL and return a JPEG data URL for vision. */
export async function renderBinderGridTileDataUrl(
  sourceDataUrl: string,
  tile: BinderGridTile,
  maxSide = 2560,
): Promise<string | null> {
  const img = await loadImageElement(sourceDataUrl);
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (nw < 8 || nh < 8) return null;

  const sx = Math.floor(tile.left * nw);
  const sy = Math.floor(tile.top * nh);
  const sw = Math.max(8, Math.floor(tile.width * nw));
  const sh = Math.max(8, Math.floor(tile.height * nh));

  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const outW = Math.max(1, Math.round(sw * scale));
  const outH = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function mapTileLocationToParent(
  location: VisionGridLocation,
  tile: BinderGridTile,
): VisionGridLocation {
  const [y, x] = location;
  const py = Math.round(tile.top * 1000 + (y / 1000) * tile.height * 1000);
  const px = Math.round(tile.left * 1000 + (x / 1000) * tile.width * 1000);
  return [
    Math.max(0, Math.min(1000, py)),
    Math.max(0, Math.min(1000, px)),
  ] as const;
}

function cardFieldScore(card: Record<string, unknown>): number {
  let score = 0;
  for (const key of ["name", "set", "number", "printedName", "rarity", "printStamps"]) {
    const v = String(card[key] ?? "").trim();
    if (v) score += 1;
  }
  return score;
}

function gridSlotKey(
  location: VisionGridLocation,
  cols: number,
  rows: number,
): string {
  const col = Math.min(cols - 1, Math.max(0, Math.floor(location[1] / (1000 / cols))));
  const row = Math.min(rows - 1, Math.max(0, Math.floor(location[0] / (1000 / rows))));
  return `${row}:${col}`;
}

/** Expected grid for dedupe — must match real binder layout, not raw detection count. */
function inferDedupeGridShape(
  count: number,
  aspectRatio?: number,
): { cols: number; rows: number } {
  if (aspectRatio != null && aspectRatio >= 0.82 && aspectRatio <= 1.18) {
    return { cols: 3, rows: 3 };
  }
  if (aspectRatio != null && aspectRatio >= 1.15) {
    if (count >= 20) return { cols: 5, rows: 4 };
    if (count >= 15) return { cols: 5, rows: 3 };
    if (count >= 10) return { cols: 5, rows: 3 };
    if (count >= 6) return { cols: 4, rows: 3 };
    return { cols: 4, rows: 2 };
  }
  if (count >= 20) return { cols: 4, rows: 5 };
  if (count >= 12) return { cols: 3, rows: 4 };
  if (count >= 9) return { cols: 3, rows: 3 };
  if (count >= 6) return { cols: 3, rows: 2 };
  return { cols: 2, rows: Math.max(1, Math.ceil(count / 2)) };
}

/** Classic binder pages (≤9 cards) should use one vision pass — not client tiling. */
export function shouldTileBinderGridImage(width: number, height: number): boolean {
  const plan = planBinderGridTiles(width, height);
  return plan.tiles.length > 9;
}

/**
 * Merge tiled vision hits: one card per grid slot; overlap duplicates lose to the richer read.
 * Identical Pokémon in different slots (e.g. two Jolteon) are kept when centers differ.
 */
export function resolveDedupeGridShape(
  cardCount: number,
  aspectRatio: number | undefined,
  naturalWidth?: number,
  naturalHeight?: number,
): { cols: number; rows: number } {
  const fromCount = inferDedupeGridShape(Math.max(cardCount, 1), aspectRatio);
  if (!naturalWidth || !naturalHeight) return fromCount;
  const plan = planBinderGridTiles(naturalWidth, naturalHeight);
  const planSlots = plan.cols * plan.rows;
  if (cardCount <= planSlots + 1) {
    return { cols: plan.cols, rows: plan.rows };
  }
  return fromCount;
}

export function dedupeBinderGridVisionCards<T extends Record<string, unknown>>(
  cards: T[],
  aspectRatio?: number,
  naturalSize?: { width: number; height: number },
): T[] {
  const { cols, rows } = resolveDedupeGridShape(
    cards.length,
    aspectRatio,
    naturalSize?.width,
    naturalSize?.height,
  );
  const bySlot = new Map<string, T>();
  const noLocation: T[] = [];

  for (const card of cards) {
    const loc = Array.isArray(card.location) ? (card.location as number[]) : null;
    const center: VisionGridLocation | null =
      loc && loc.length >= 2 && Number.isFinite(loc[0]) && Number.isFinite(loc[1])
        ? [Number(loc[0]), Number(loc[1])]
        : null;
    if (!center) {
      noLocation.push(card);
      continue;
    }

    const slot = gridSlotKey(center, cols, rows);
    const existing = bySlot.get(slot);
    if (
      !existing ||
      cardFieldScore(card as Record<string, unknown>) >
        cardFieldScore(existing as Record<string, unknown>)
    ) {
      bySlot.set(slot, card);
    }
  }

  return [...bySlot.values(), ...noLocation];
}
