import { resolveGraderBadge } from "@/lib/scan/grader-badge-styles";
import { cn } from "@/lib/cn";

export function GraderChip({
  grader,
  grade,
  labelTitle,
  className,
}: {
  grader: string | null | undefined;
  grade?: string | null;
  labelTitle?: string | null;
  className?: string;
}) {
  if (!grader?.trim()) return null;
  const style = resolveGraderBadge({ grader, grade, labelTitle });
  if (style.tier === "raw") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        style.chipClass,
        style.ringClass,
        className,
      )}
    >
      {style.brandLabel}
      <span className="font-mono normal-case tabular-nums">{style.gradeDisplay}</span>
    </span>
  );
}
