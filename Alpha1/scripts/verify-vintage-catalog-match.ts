/**
 * Simulate DB catalog matching for vintage print-run grid expectations.
 * Usage: npx --yes tsx --env-file=.env.local scripts/verify-vintage-catalog-match.ts
 */
import { loadEnvLocal } from "../scripts/load-env-local.mjs";
import { searchDbCatalog } from "@/lib/catalog/db-catalog";
import { applyCatalogIdentityHardening } from "@/lib/scan/same-art-disambiguation";
import { applyVintagePrintRunHardening } from "@/lib/scan/vintage-print-run";
import { extractedCardSchema, type ExtractedCard } from "@/lib/scan/schemas";

loadEnvLocal();

type GridCase = {
  label: string;
  card: Partial<ExtractedCard>;
  expectedCatalogId: string;
  minStatus?: "confirmed" | "likely" | "ambiguous";
};

const GRID: GridCase[] = [
  {
    label: "Dark Charizard TR 1st",
    card: {
      franchise: "pokemon",
      name: "Dark Charizard",
      set: "Team Rocket",
      number: "4/82",
      printStamps: "1st Edition",
      year: "2000",
    },
    expectedCatalogId: "base5-4__first_edition",
  },
  {
    label: "Dark Charizard TR Unlimited",
    card: {
      franchise: "pokemon",
      name: "Dark Charizard",
      set: "Team Rocket",
      number: "4/82",
      printStamps: "Unlimited",
      year: "2000",
    },
    expectedCatalogId: "base5-4__unlimited",
  },
  {
    label: "Blaine's Charizard Gym 1st",
    card: {
      franchise: "pokemon",
      name: "Blaine's Charizard",
      set: "Gym Challenge",
      number: "2/132",
      printStamps: "1st Edition",
      year: "2000",
    },
    expectedCatalogId: "gym2-2__first_edition",
  },
  {
    label: "Blaine's Charizard Gym Unlimited",
    card: {
      franchise: "pokemon",
      name: "Blaine's Charizard",
      set: "Gym Challenge",
      number: "2/132",
      printStamps: "Unlimited",
      year: "2000",
    },
    expectedCatalogId: "gym2-2__unlimited",
  },
  {
    label: "Lugia Neo Genesis 1st",
    card: {
      franchise: "pokemon",
      name: "Lugia",
      set: "Neo Genesis",
      number: "9/111",
      printStamps: "1st Edition",
      year: "2000",
    },
    expectedCatalogId: "neo1-9__first_edition",
  },
  {
    label: "Charizard Base 1st Shadowless",
    card: {
      franchise: "pokemon",
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      printStamps: "1st Edition",
      details: "no drop shadow on art frame",
      year: "1999",
    },
    expectedCatalogId: "base1-4__first_edition",
  },
  {
    label: "Charizard Shadowless Unlimited",
    card: {
      franchise: "pokemon",
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      printStamps: "Shadowless",
      details: "no drop shadow on art frame",
      year: "1999",
    },
    expectedCatalogId: "base1-4__shadowless",
  },
  {
    label: "Charizard Unlimited shadowed",
    card: {
      franchise: "pokemon",
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      printStamps: "Unlimited",
      details: "drop shadow on art frame",
      year: "1999",
    },
    expectedCatalogId: "base1-4__unlimited",
  },
  {
    label: "German Glurak Base 1st",
    card: {
      franchise: "pokemon",
      name: "Charizard",
      printedName: "Glurak",
      language: "German",
      set: "Base Set",
      number: "4/102",
      printStamps: "1st Edition",
      year: "1999",
    },
    expectedCatalogId: "base1-4__first_edition",
  },
];

async function main() {
  console.log("Vintage catalog match simulation\n");
  let ok = true;

  for (const spec of GRID) {
    const raw = applyVintagePrintRunHardening(
      applyCatalogIdentityHardening(
        extractedCardSchema.parse({
          franchise: "pokemon",
          encapsulation: "raw",
          visionLane: "raw",
          ...spec.card,
        }),
      ),
    );

    const match = await searchDbCatalog(raw, "pokemon");
    const got = match?.catalogId ?? "(none)";
    const status = match?.catalogIdentityStatus ?? "failed";
    const pass =
      got === spec.expectedCatalogId &&
      status !== "failed" &&
      (status === "confirmed" || status === "likely");

    if (pass) {
      console.log(`  OK  ${spec.label}`);
      console.log(`      → ${got} (${status}, score ${match?.score ?? 0})`);
    } else {
      ok = false;
      console.error(`  FAIL ${spec.label}`);
      console.error(`      expected ${spec.expectedCatalogId}, got ${got} (${status})`);
      if (match?.candidates?.[0]) {
        console.error(
          `      top: ${match.candidates[0].catalogId} conflicts=${match.candidates[0].conflicts?.join(",") ?? ""}`,
        );
      }
    }
  }

  if (!ok) process.exit(1);
  console.log("\nVintage catalog match simulation passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
