import { readFileSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3002";
const smokePngBase64 = readFileSync(
  join(
    process.cwd(),
    "public",
    "catalog-variant-artwork",
    "base6",
    "base6-3_reverse.png",
  ),
).toString("base64");

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { response, data };
}

async function main() {
  const vision = await postJson("/api/vision/extract", {
    imageBase64s: [smokePngBase64],
    imageMimeTypes: ["image/png"],
  });
  const cards =
    vision.response.ok && Array.isArray(vision.data.cards)
      ? vision.data.cards
      : [];
  const visionError = vision.response.ok
    ? null
    : (vision.data.error ?? vision.data);
  const sampleCard = cards[0] ?? {
    name: "Smoke Test Card",
    set: "Base Set",
    number: "4",
    year: "1999",
    visionLane: "raw",
  };

  const enrich = await postJson("/api/scan/enrich", {
    specimenId: "specimen-smoke",
    card: sampleCard,
  });
  if (!enrich.response.ok) {
    throw new Error(
      `Enrich failed (${enrich.response.status}): ${JSON.stringify(enrich.data)}`,
    );
  }

  const catalog = await postJson("/api/scan/enrich", {
    specimenId: "specimen-tcgdex-fr-smoke",
    phase: "catalog",
    card: {
      encapsulation: "raw",
      name: "Dracaufeu obscur",
      printedName: "Dracaufeu obscur",
      language: "French",
      set: "Team Rocket",
      number: "4/82",
      year: "2000",
      rarity: "",
      printStamps: "",
      details: "",
      location: [500, 500],
    },
  });
  if (!catalog.response.ok || catalog.data.catalogId !== "base5-4") {
    throw new Error(
      `Catalog smoke failed (${catalog.response.status}): ${JSON.stringify(catalog.data)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        visionProvider: vision.data.provider ?? null,
        visionCardCount: cards.length,
        visionError,
        enrichMarketEvidence: Array.isArray(enrich.data.context?.marketEvidence)
          ? enrich.data.context.marketEvidence.length
          : 0,
        enrichSourceLinks: Array.isArray(enrich.data.context?.marketSourceLinks)
          ? enrich.data.context.marketSourceLinks.length
          : 0,
        catalogMatched: catalog.data.catalogMatched === true,
        catalogId: catalog.data.catalogId ?? null,
        catalogName: catalog.data.card?.name ?? null,
        catalogConfidence: catalog.data.context?.catalogConfidence ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
