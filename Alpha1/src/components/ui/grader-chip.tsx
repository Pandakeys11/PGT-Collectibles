import { Badge } from "@/components/ui/badge";

export function GraderChip({ grader }: { grader: string | null | undefined }) {
  if (!grader) return null;
  return <Badge tone="accent">{grader.toUpperCase()}</Badge>;
}
