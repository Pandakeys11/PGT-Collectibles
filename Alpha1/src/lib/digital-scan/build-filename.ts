import type { ExtractedCard } from "@/lib/scan/schemas";
import type { ScanCardContext } from "@/lib/scan/schemas";

function sanitizeSegment(value: string, maxLen = 48): string {
  return value
    .trim()
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
}

export function buildDigitalScanFilename(args: {
  index: number;
  card: ExtractedCard;
  context?: Pick<ScanCardContext, "lane" | "catalogId">;
  ext: "jpg" | "png";
}): string {
  const { index, card, context, ext } = args;
  const idx = String(index).padStart(3, "0");
  const name = sanitizeSegment(card.name || "Unknown", 32) || "Card";
  const set = sanitizeSegment(card.set?.split("·")[0]?.trim() || "", 24);
  const num = sanitizeSegment(card.number?.replace(/\//g, "-") || "", 16);
  const grade =
    context?.lane === "graded" && card.grader && card.grade
      ? sanitizeSegment(`${card.grader}${card.grade}`, 12)
      : "";

  const parts = [idx, name];
  if (set) parts.push(set);
  if (num) parts.push(num);
  if (grade) parts.push(grade);

  return `${parts.join("_")}.${ext}`;
}
