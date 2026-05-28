/**
 * Smoke: batch catalog enrich.
 * Usage: node scripts/smoke-enrich-batch.mjs [baseUrl]
 */
const baseUrl = process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3002";

const cards = [
  { name: "Charizard", set: "Base Set", number: "4/102", year: "1999", visionLane: "raw" },
  { name: "Blastoise", set: "Base Set", number: "2/102", year: "1999", visionLane: "raw" },
  { name: "Venusaur", set: "Base Set", number: "15/102", year: "1999", visionLane: "raw" },
];

async function post(path, body) {
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
    data = { raw: text.slice(0, 500) };
  }
  return { status: response.status, ok: response.ok, data };
}

async function main() {
  const batch = await post("/api/scan/enrich-batch", {
    phase: "catalog",
    items: cards.map((card, index) => ({
      specimenId: `smoke-batch-${index}`,
      card,
      phase: "catalog",
    })),
  });
  if (!batch.ok) {
    throw new Error(`Batch enrich failed (${batch.status}): ${JSON.stringify(batch.data)}`);
  }
  const results = batch.data.results ?? [];
  const ok = results.filter((r) => r.ok);
  console.log(
    JSON.stringify(
      {
        ok: ok.length,
        total: results.length,
        sampleCatalogId: ok[0]?.catalogId ?? null,
      },
      null,
      2,
    ),
  );
  if (ok.length !== cards.length) {
    throw new Error(`Expected ${cards.length} ok results, got ${ok.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
