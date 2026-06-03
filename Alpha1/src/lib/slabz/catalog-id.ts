import type { SlabzCard } from "@/lib/slabz/types";

export function catalogIdForSlabzCard(card: SlabzCard, transactionId?: string): string {
  const mint = card.nftMint?.trim();
  if (mint) return `slabz:${mint}`;
  if (transactionId?.trim()) return `slabz:tx:${transactionId.trim()}`;
  return `slabz:unknown:${(card.name ?? "slab").slice(0, 32)}`;
}

export function catalogIdForSlabzPack(packId: string): string {
  return `slabz-pack:${packId.trim()}`;
}
