import { createHash } from "node:crypto";
import { hasReadableCertNumber } from "@/lib/scan/graded-slab";
import { classifyCardLane } from "@/lib/scan/lane";
import { franchiseLabel } from "@/lib/scan/franchise";
import type { ExtractedCard } from "@/lib/scan/schemas";

function norm(part: string | null | undefined): string {
  return (part?.trim().toLowerCase() ?? "").replace(/\s+/g, " ");
}

function certDigits(cert: string | null | undefined): string {
  if (!cert || !hasReadableCertNumber(cert)) return "";
  return cert.replace(/\D/g, "");
}

/**
 * Stable identity for PGT registry + market history.
 * Graded slabs with a readable cert hash grader|cert first (unique slab).
 */
export function pgtIdentityHash(card: ExtractedCard): string {
  const lane = classifyCardLane(card as Record<string, unknown>).lane;
  const digits = certDigits(card.cert);
  const grader = norm(card.grader);

  const parts: string[] = [norm(franchiseLabel(card))];

  if (lane === "graded" && digits.length >= 6 && grader) {
    parts.push("slab", grader, digits);
  } else {
    parts.push(
      norm(card.name),
      norm(card.set),
      norm(card.number),
      norm(card.year),
      norm(card.printStamps),
    );
    if (lane === "graded") {
      parts.push("graded", grader, norm(card.grade));
    } else {
      parts.push("raw");
    }
  }

  const key = parts.filter(Boolean).join("|");
  return createHash("sha256").update(key).digest("hex");
}

export function buildVariantKey(card: ExtractedCard): string | null {
  const bits = [
    card.language,
    card.printedName,
    card.printStamps,
    card.details,
    card.rarity,
  ]
    .map((v) => v?.trim())
    .filter(Boolean);
  return bits.length > 0 ? bits.join(" · ") : null;
}
