import type { Metadata } from "next";
import { CollectorCommandCenter } from "@/components/redesign/collector-command-center";

export const metadata: Metadata = {
  title: "Command center",
  description:
    "Scan, catalog, market analytics, and AI insight for PGT Collectibles.",
};

export default function ScannerPage() {
  return <CollectorCommandCenter />;
}
