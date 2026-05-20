/**
 * Smoke: catalog + market enrich phases and FMV fields.
 * Usage: node scripts/smoke-enrich-market.mjs [baseUrl]
 */
const baseUrl = process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3002";

const sampleCard = {
  name: "Charizard",
  set: "Base Set",
  number: "4/102",
  year: "1999",
  visionLane: "raw",
  language: "English",
};

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
  const catalog = await post("/api/scan/enrich", {
    specimenId: "smoke-catalog",
    card: sampleCard,
    phase: "catalog",
  });
  if (!catalog.ok) {
    throw new Error(`Catalog enrich failed (${catalog.status}): ${JSON.stringify(catalog.data)}`);
  }

  const market = await post("/api/scan/enrich", {
    specimenId: "smoke-market",
    card: catalog.data.card ?? sampleCard,
    phase: "market",
    catalogId: catalog.data.catalogId ?? null,
    catalogImageUrl: catalog.data.context?.catalogImageUrl ?? null,
    skipCache: true,
  });
  if (!market.ok) {
    throw new Error(`Market enrich failed (${market.status}): ${JSON.stringify(market.data)}`);
  }

  const ctx = market.data.context ?? {};
  const evidence = Array.isArray(ctx.marketEvidence) ? ctx.marketEvidence : [];
  const links = Array.isArray(ctx.marketSourceLinks) ? ctx.marketSourceLinks : [];

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        catalogMatched: catalog.data.catalogMatched ?? null,
        catalogId: catalog.data.catalogId ?? null,
        marketEvidenceCount: evidence.length,
        marketSourceLinksCount: links.length,
        fairValueUsd: ctx.fairValueUsd ?? null,
        fairValueBasis: ctx.fairValueBasis ?? null,
        sampleEvidence: evidence.slice(0, 2).map((e) => ({
          kind: e.kind,
          source: e.source,
          priceUsd: e.priceUsd,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
