/**
 * Verify same-name catalog variants appear in pick options (Neo Typhlosion 17 vs 18).
 * Usage: npx --yes tsx --env-file=.env.local scripts/verify-same-name-catalog-candidates.ts
 */
import { loadEnvLocal } from "../scripts/load-env-local.mjs";
import { ensureCatalogMatchOptions } from "@/lib/market/ensure-catalog-options";
import { extractedCardSchema, type ExtractedCard } from "@/lib/scan/schemas";

loadEnvLocal();

type Case = {
  label: string;
  card: Partial<ExtractedCard>;
  mustInclude: string[];
  preferredTop?: string;
};

const CASES: Case[] = [
  {
    label: "Neo Typhlosion 17/111",
    card: {
      franchise: "pokemon",
      name: "Typhlosion",
      set: "Neo Genesis",
      number: "17/111",
      printStamps: "Unlimited",
      year: "2000",
    },
    mustInclude: ["neo1-17", "neo1-18"],
    preferredTop: "neo1-17",
  },
  {
    label: "Neo Typhlosion 18/111",
    card: {
      franchise: "pokemon",
      name: "Typhlosion",
      set: "Neo Genesis",
      number: "18/111",
      printStamps: "Unlimited",
      year: "2000",
    },
    mustInclude: ["neo1-17", "neo1-18"],
    preferredTop: "neo1-18",
  },
  {
    label: "Neo Typhlosion name-only (no number)",
    card: {
      franchise: "pokemon",
      name: "Typhlosion",
      set: "Neo Genesis",
      number: "",
      printStamps: "Holo",
      year: "2000",
    },
    mustInclude: ["neo1-17", "neo1-18"],
  },
  {
    label: "Gym Challenge Erika's Venusaur 4/132",
    card: {
      franchise: "pokemon",
      name: "Erika's Venusaur",
      set: "Gym Challenge",
      number: "4/132",
      printStamps: "Unlimited",
      year: "2000",
    },
    mustInclude: ["gym2-4"],
  },
];

async function main() {
  console.log("Same-name catalog candidate supplementation\n");
  let ok = true;

  for (const spec of CASES) {
    const card = extractedCardSchema.parse({
      franchise: "pokemon",
      encapsulation: "raw",
      visionLane: "raw",
      ...spec.card,
    });

    const match = await ensureCatalogMatchOptions(card);
    const ids = match?.candidates.map((c) => c.catalogId) ?? [];
    const missing = spec.mustInclude.filter((id) => !ids.includes(id));
    const top = ids[0] ?? "(none)";

    const pass = missing.length === 0;
    if (!pass) ok = false;

    console.log(`${pass ? "OK" : "FAIL"}  ${spec.label}`);
    console.log(`      top: ${top} (${match?.catalogIdentityStatus ?? "failed"}, score ${match?.score ?? 0})`);
    console.log(`      candidates (${ids.length}): ${ids.slice(0, 8).join(", ")}${ids.length > 8 ? "…" : ""}`);
    if (missing.length) console.error(`      missing: ${missing.join(", ")}`);
    if (spec.preferredTop && top !== spec.preferredTop) {
      console.log(`      note: preferred top ${spec.preferredTop}, got ${top}`);
    }
  }

  if (!ok) process.exit(1);
  console.log("\nSame-name catalog candidate checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
