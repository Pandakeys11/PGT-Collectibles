/**
 * Companion sprite URLs — Option A (Showdown), Option B (hosted), Option C (artwork).
 * Gen 5 animated fallback is intentionally disabled for uniform Showdown-style GIFs.
 */

import { resolveShowdownSlug, showdownAnimatedUrl } from "@/lib/companion/showdown-slugs";
import { getHostedAnimatedUrl, getHostedArtworkUrl } from "@/lib/companion/sprite-assets";

export { resolveShowdownSlug, showdownAnimatedUrl };

export function officialArtworkUrl(nationalId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${nationalId}.png`;
}

/** @deprecated Gen 5 hidden — use Showdown ani or hosted artwork only. */
export function gen5AnimatedUrl(_nationalId: number): string {
  void _nationalId;
  return "";
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * Animated: hosted (B) when enabled → Showdown (A).
 * Skips hosted ani URL when manifest marks hasAni false (e.g. Miraidon).
 */
export function animatedSpriteSources(nationalId: number, slug: string): string[] {
  const sources: string[] = [];
  const hostedAni = getHostedAnimatedUrl(nationalId);
  if (hostedAni) sources.push(hostedAni);
  sources.push(showdownAnimatedUrl(slug));
  return uniqueUrls(sources);
}

/** Artwork: hosted PNG → PokeAPI official art. */
export function artworkSpriteSources(nationalId: number): string[] {
  const sources: string[] = [];
  const hostedArt = getHostedArtworkUrl(nationalId);
  if (hostedArt) sources.push(hostedArt);
  sources.push(officialArtworkUrl(nationalId));
  return uniqueUrls(sources);
}

/** @deprecated Use animatedSpriteSources */
export function spriteChain(nationalId: number, slug: string): string[] {
  return animatedSpriteSources(nationalId, slug);
}
