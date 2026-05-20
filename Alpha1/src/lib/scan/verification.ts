import type { ExtractedCard, VerificationField, VerificationFieldStatus } from "@/lib/scan/schemas";

export type RegistrySnapshot = {
  certNumber: string | null;
  cardName: string | null;
  grade: string | null;
  grader: string | null;
  registryUrl: string | null;
  isVerified: boolean;
};

function statusForPair(extracted: string | null, verified: string | null): VerificationFieldStatus {
  if (!extracted && !verified) return "unverified";
  if (!extracted || !verified) return "unverified";
  const a = extracted.trim().toLowerCase();
  const b = verified.trim().toLowerCase();
  if (a === b) return "verified";
  if (a.includes(b) || b.includes(a)) return "verified";
  return "mismatch";
}

export function buildVerificationFields(
  card: ExtractedCard,
  registry?: RegistrySnapshot | null,
): VerificationField[] {
  const fields: VerificationField[] = [
    {
      field: "name",
      extracted: card.name ?? null,
      verified: registry?.cardName ?? null,
      status: statusForPair(card.name ?? null, registry?.cardName ?? null),
    },
    {
      field: "print / stamps",
      extracted: card.printStamps ?? null,
      verified: null,
      status: "unverified",
    },
    {
      field: "cert",
      extracted: card.cert ?? null,
      verified: registry?.certNumber ?? null,
      status: statusForPair(card.cert ?? null, registry?.certNumber ?? null),
    },
    {
      field: "grade",
      extracted: card.grade ?? null,
      verified: registry?.grade ?? null,
      status: statusForPair(card.grade ?? null, registry?.grade ?? null),
    },
    {
      field: "grader",
      extracted: card.grader ?? null,
      verified: registry?.grader ?? null,
      status: statusForPair(card.grader ?? null, registry?.grader ?? null),
    },
  ];

  return fields;
}

export function deriveVerificationStatus(fields: VerificationField[]): "verified" | "partial" | "failed" {
  if (fields.some((f) => f.status === "mismatch")) return "failed";
  const actionable = fields.filter((f) => f.extracted || f.verified);
  if (actionable.length === 0) return "partial";
  const verifiedCount = actionable.filter((f) => f.status === "verified").length;
  if (verifiedCount === actionable.length) return "verified";
  if (verifiedCount > 0) return "partial";
  return "partial";
}

export function deriveConfidence(fields: VerificationField[], lane: "raw" | "graded"): number {
  const actionable = fields.filter((f) => f.extracted || f.verified);
  if (actionable.length === 0) return lane === "raw" ? 0.55 : 0.35;
  const verifiedCount = actionable.filter((f) => f.status === "verified").length;
  return Math.min(1, verifiedCount / actionable.length);
}
