import { pgtIdentityHash } from "@/lib/pgt-registry/identity";
import type { ExtractedCard } from "@/lib/scan/schemas";

/** @deprecated alias — use pgtIdentityHash for new code */
export function marketIdentityHash(card: ExtractedCard): string {
  return pgtIdentityHash(card);
}

