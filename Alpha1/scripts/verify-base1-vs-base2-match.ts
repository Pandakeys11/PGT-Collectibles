/**
 * Base Set (/102) vs Base Set 2 (/130) collision checks for Charizard.
 * Usage: npx --yes tsx --env-file=.env.local scripts/verify-base1-vs-base2-match.ts
 */
import { loadEnvLocal } from "../scripts/load-env-local.mjs";
import { searchDbCatalog } from "@/lib/catalog/db-catalog";
import { applyCatalogIdentityHardening } from "@/lib/scan/same-art-disambiguation";
import { applyVintagePrintRunHardening } from "@/lib/scan/vintage-print-run";
import { extractedCardSchema, type ExtractedCard } from "@/lib/scan/schemas";

loadEnvLocal();

type Case = {
  label: string;
  card: Partial<ExtractedCard>;
  expectBase1?: boolean;
};

const CASES: Case[] = [
  {
    label: "Correct Base Unlimited /102 shadowed",
    card: {
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      printStamps: "Unlimited",
      details: "drop shadow on art frame",
      year: "1999",
    },
    expectBase1: true,
  },
  {
    label: "Vision misread set as Base Set 2 but /102",
    card: {
      name: "Charizard",
      set: "Base Set 2",
      number: "4/102",
      printStamps: "Unlimited",
      details: "drop shadow on art frame",
      year: "2000",
    },
    expectBase1: true,
  },
  {
    label: "Vision misread denom /130 on Base Set card",
    card: {
      name: "Charizard",
      set: "Base Set",
      number: "4/130",
      printStamps: "Unlimited",
      details: "drop shadow on art frame",
      year: "1999",
    },
    expectBase1: true,
  },
  {
    label: "Blank set /130 unlimited shadowed (grid bottom row OCR)",
    card: {
      name: "Charizard",
      set: "",
      number: "4/130",
      printStamps: "Unlimited",
      details: "drop shadow on art frame",
      year: "1999",
    },
    expectBase1: true,
  },
  {
    label: "Correct Base Set 2 /130",
    card: {
      name: "Charizard",
      set: "Base Set 2",
      number: "4/130",
      printStamps: "Unlimited",
      year: "2000",
    },
    expectBase1: false,
  },
  {
    label: "Holo only no print stamp /102 shadowed",
    card: {
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      rarity: "Holo Rare",
      details: "drop shadow on art frame",
      year: "1999",
    },
    expectBase1: true,
  },
  {
    label: "Number numerator only (no /102)",
    card: {
      name: "Charizard",
      set: "Base Set",
      number: "4",
      printStamps: "Unlimited",
      details: "drop shadow on art frame",
      year: "1999",
    },
    expectBase1: true,
  },
  {
    label: "Blank set /102 unlimited",
    card: {
      name: "Charizard",
      set: "",
      number: "4/102",
      printStamps: "Unlimited",
      details: "drop shadow on art frame",
      year: "1999",
    },
    expectBase1: true,
  },
];

async function main() {
  console.log("Base Set vs Base Set 2 Charizard match simulation\n");
  let ok = true;

  for (const spec of CASES) {
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
    const isBase1 = got.startsWith("base1-");
    const isBase4 = got.startsWith("base4-");
    const pass = spec.expectBase1 ? isBase1 : isBase4 || got.includes("base4");

    console.log(`${pass ? "OK" : "FAIL"}  ${spec.label}`);
    console.log(
      `      hardened: set=${JSON.stringify(raw.set)} number=${raw.number} stamps=${raw.printStamps}`,
    );
    console.log(
      `      → ${got} (${match?.catalogIdentityStatus ?? "failed"}, score ${match?.score ?? 0})`,
    );
    const top = match?.candidates?.[0];
    const run = match?.candidates?.[1];
    if (top) {
      console.log(
        `      top: ${top.catalogId} | ${top.setName} ${top.cardNumber} | conflicts=${top.conflicts?.join(",") ?? ""}`,
      );
    }
    if (run) {
      console.log(
        `      #2:  ${run.catalogId} | ${run.setName} ${run.cardNumber} | score ${run.score}`,
      );
    }

    if (!pass) ok = false;
  }

  if (!ok) process.exit(1);
  console.log("\nAll base1 vs base4 checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
