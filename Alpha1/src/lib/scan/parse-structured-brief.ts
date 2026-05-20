import { structuredBriefSchema, type ScanCardContext, type StructuredBrief } from "@/lib/scan/schemas";
import { parseNarrationBriefFromLlm } from "@/lib/scan/narration-brief";
export function parseStructuredBriefFromLlm(
  raw: string,
  context: ScanCardContext,
): ReturnType<typeof structuredBriefSchema.safeParse> {
  const result = parseNarrationBriefFromLlm(raw, context);
  if (result.ok) {
    return structuredBriefSchema.safeParse(result.brief);
  }
  return structuredBriefSchema.safeParse({});
}

export function briefToMarkdown(brief: StructuredBrief): string {
  const sections: string[] = [brief.summary];

  if (brief.marketSnapshot?.trim()) {
    sections.push("", "## Market snapshot", brief.marketSnapshot.trim());
  }
  if (brief.compAnalysis?.trim()) {
    sections.push("", "## Comp analysis", brief.compAnalysis.trim());
  }

  sections.push(
    "",
    "## Verification",
    ...brief.verification.map(
      (row) =>
        `- ${row.field}: ${row.extracted ?? "—"} → ${row.verified ?? "—"} (${row.status})`,
    ),
  );

  if (brief.gradedSupply?.trim()) {
    sections.push("", "## Graded supply", brief.gradedSupply.trim());
  }

  sections.push("", "## Valuation", brief.valuation);

  if (brief.nextChecks.length > 0) {
    sections.push("", "## Next checks", ...brief.nextChecks.map((item) => `• ${item}`));
  }

  return sections.join("\n");
}
