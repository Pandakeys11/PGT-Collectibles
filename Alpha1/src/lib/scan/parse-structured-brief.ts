import { structuredBriefSchema, type ScanCardContext, type StructuredBrief } from "@/lib/scan/schemas";

export function parseStructuredBriefFromLlm(
  raw: string,
  context: ScanCardContext,
): ReturnType<typeof structuredBriefSchema.safeParse> {
  try {
    const jsonText = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? raw;
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    if (
      Array.isArray(parsed.marketEvidence) &&
      parsed.marketEvidence.length === 0 &&
      context.marketEvidence.length > 0
    ) {
      parsed.marketEvidence = context.marketEvidence.slice(0, 8);
    }
    return structuredBriefSchema.safeParse(parsed);
  } catch {
    return structuredBriefSchema.safeParse({});
  }
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
