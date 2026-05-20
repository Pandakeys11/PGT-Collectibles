import { Badge } from "@/components/ui/badge";
import { verificationToBadgeTone } from "@/lib/energy-theme";

export function VerificationPill({ status }: { status: "verified" | "partial" | "failed" }) {
  const tone = verificationToBadgeTone(status);
  const label =
    status === "verified" ? "Verified" : status === "partial" ? "Needs review" : "Failed";
  return <Badge tone={tone}>{label}</Badge>;
}
