/** RGB triplet for CSS `rgb(var(--token) / α)` usage. */
export type RgbTriplet = `${number} ${number} ${number}`;

export type CatalogAmbientPalette = {
  holoA: RgbTriplet;
  holoB: RgbTriplet;
  holoC: RgbTriplet;
  gradientMid: RgbTriplet;
  gradientBloom: RgbTriplet;
  sparkPrimary: string;
  sparkSecondary: string;
  sparkTertiary: string;
};

export type CatalogAmbientSource = {
  id: string;
  name?: string | null;
  imageUrl?: string | null;
};

/** Obsidian default — matches `theme-spectrum.css` obsidian-clean. */
export const OBSIDIAN_AMBIENT: CatalogAmbientPalette = {
  holoA: "141 153 174",
  holoB: "255 230 0",
  holoC: "201 214 223",
  gradientMid: "10 12 18",
  gradientBloom: "40 50 70",
  sparkPrimary: "#8d99ae",
  sparkSecondary: "#ffe600",
  sparkTertiary: "#fff7a8",
};

const paletteCache = new Map<string, CatalogAmbientPalette>();

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function triplet(r: number, g: number, b: number): RgbTriplet {
  return `${clampByte(r)} ${clampByte(g)} ${clampByte(b)}` as RgbTriplet;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    clampByte((r + m) * 255),
    clampByte((g + m) * 255),
    clampByte((b + m) * 255),
  ];
}

/** Deterministic set palette when logo sampling is unavailable. */
export function paletteFromSetKey(key: string): CatalogAmbientPalette {
  const cached = paletteCache.get(`hash:${key}`);
  if (cached) return cached;

  const h = hashString(key) % 360;
  const [r1, g1, b1] = hslToRgb(h, 0.62, 0.48);
  const [r2, g2, b2] = hslToRgb((h + 52) % 360, 0.55, 0.38);
  const [r3, g3, b3] = hslToRgb((h + 128) % 360, 0.42, 0.62);
  const [rm, gm, bm] = hslToRgb(h, 0.35, 0.12);

  const palette: CatalogAmbientPalette = {
    holoA: triplet(r1, g1, b1),
    holoB: triplet(r2, g2, b2),
    holoC: triplet(r3, g3, b3),
    gradientMid: triplet(rm, gm, bm),
    gradientBloom: triplet(
      Math.min(255, r1 * 0.35 + rm),
      Math.min(255, g1 * 0.35 + gm),
      Math.min(255, b1 * 0.35 + bm),
    ),
    sparkPrimary: `rgb(${r1}, ${g1}, ${b1})`,
    sparkSecondary: `rgb(${r2}, ${g2}, ${b2})`,
    sparkTertiary: `rgb(${r3}, ${g3}, ${b3})`,
  };
  paletteCache.set(`hash:${key}`, palette);
  return palette;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`;
}

function buildPaletteFromSamples(samples: Array<[number, number, number]>): CatalogAmbientPalette {
  if (!samples.length) return OBSIDIAN_AMBIENT;

  const sorted = [...samples].sort((a, b) => {
    const sa = a[0] + a[1] + a[2];
    const sb = b[0] + b[1] + b[2];
    return sb - sa;
  });

  const pick = (idx: number): [number, number, number] => sorted[Math.min(idx, sorted.length - 1)]!;
  const a = pick(0);
  const b = pick(Math.floor(sorted.length * 0.35));
  const c = pick(Math.floor(sorted.length * 0.68));
  const mid = pick(Math.floor(sorted.length * 0.85));

  return {
    holoA: triplet(...a),
    holoB: triplet(...b),
    holoC: triplet(...c),
    gradientMid: triplet(mid[0] * 0.22, mid[1] * 0.22, mid[2] * 0.28),
    gradientBloom: triplet(a[0] * 0.45, a[1] * 0.45, a[2] * 0.55),
    sparkPrimary: rgbToHex(...a),
    sparkSecondary: rgbToHex(...b),
    sparkTertiary: rgbToHex(...c),
  };
}

function sampleImagePixels(img: HTMLImageElement): Array<[number, number, number]> {
  const size = 36;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const out: Array<[number, number, number]> = [];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (a < 40) continue;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < 28 || lum > 238) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.12) continue;
    out.push([r, g, b]);
  }
  return out;
}

export async function resolveCatalogAmbientPalette(
  source: CatalogAmbientSource,
): Promise<CatalogAmbientPalette> {
  const cacheKey = source.id;
  const hit = paletteCache.get(cacheKey);
  if (hit) return hit;

  const url = source.imageUrl?.trim();
  if (url && typeof window !== "undefined") {
    try {
      const palette = await new Promise<CatalogAmbientPalette>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        const finish = (p: CatalogAmbientPalette) => resolve(p);
        img.onload = () => {
          const samples = sampleImagePixels(img);
          finish(samples.length ? buildPaletteFromSamples(samples) : paletteFromSetKey(source.id));
        };
        img.onerror = () => finish(paletteFromSetKey(source.id));
        img.src = url;
      });
      paletteCache.set(cacheKey, palette);
      return palette;
    } catch {
      /* fall through */
    }
  }

  const fallback = paletteFromSetKey(source.name?.trim() || source.id);
  paletteCache.set(cacheKey, fallback);
  return fallback;
}

function parseTriplet(value: string): [number, number, number] {
  const parts = value.trim().split(/\s+/).map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function lerpCatalogAmbientPalette(
  from: CatalogAmbientPalette,
  to: CatalogAmbientPalette,
  t: number,
): CatalogAmbientPalette {
  const u = Math.max(0, Math.min(1, t));
  const lerpTriplet = (a: RgbTriplet, b: RgbTriplet): RgbTriplet => {
    const [ar, ag, ab] = parseTriplet(a);
    const [br, bg, bb] = parseTriplet(b);
    return triplet(ar + (br - ar) * u, ag + (bg - ag) * u, ab + (bb - ab) * u);
  };

  return {
    holoA: lerpTriplet(from.holoA, to.holoA),
    holoB: lerpTriplet(from.holoB, to.holoB),
    holoC: lerpTriplet(from.holoC, to.holoC),
    gradientMid: lerpTriplet(from.gradientMid, to.gradientMid),
    gradientBloom: lerpTriplet(from.gradientBloom, to.gradientBloom),
    sparkPrimary: u < 0.5 ? from.sparkPrimary : to.sparkPrimary,
    sparkSecondary: u < 0.5 ? from.sparkSecondary : to.sparkSecondary,
    sparkTertiary: u < 0.5 ? from.sparkTertiary : to.sparkTertiary,
  };
}
