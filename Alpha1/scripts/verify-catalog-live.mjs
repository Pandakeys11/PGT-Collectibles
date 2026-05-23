/**
 * Verify live catalog source APIs (no Next server required).
 * Usage: npm run verify:catalog-live
 */

async function check(name, fn) {
  try {
    await fn();
    console.log(`  OK  ${name}`);
    return true;
  } catch (e) {
    console.error(`  FAIL ${name}: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

async function main() {
  console.log("Live catalog sources\n");
  let ok = true;

  ok &&=
    (await check("Scryfall sets", async () => {
      const r = await fetch("https://api.scryfall.com/sets", {
        headers: { "User-Agent": "PGTVision/1.0 verify" },
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (!j.data?.length) throw new Error("empty");
    })) ;

  ok &&=
    (await check("YGOPRODeck sets", async () => {
      const r = await fetch("https://db.ygoprodeck.com/api/v7/cardsets.php");
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (!Array.isArray(j) || j.length < 10) throw new Error("empty");
    })) ;

  ok &&=
    (await check("OPTCG sets", async () => {
      const r = await fetch("https://optcgapi.com/api/allSets/");
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (!Array.isArray(j) || j.length < 1) throw new Error("empty");
    })) ;

  ok &&=
    (await check("Lorcast sets", async () => {
      const r = await fetch("https://api.lorcast.com/v0/sets");
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (!j.results?.length) throw new Error("empty");
    })) ;

  ok &&=
    (await check("Pokemon TCG sets", async () => {
      const r = await fetch("https://api.pokemontcg.io/v2/sets?pageSize=5");
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (!j.data?.length) throw new Error("empty");
    })) ;

  if (!ok) process.exit(1);
  console.log("\nAll live catalog sources reachable.");
}

main();
