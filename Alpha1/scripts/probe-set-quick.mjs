const sets = ["me2pt5", "me4", "sv01"];
for (const id of sets) {
  for (const base of [
    `https://api.tcgdex.net/v2/en/sets/${id}`,
    `https://api.pokemontcg.io/v2/cards?q=set.id:${id}&pageSize=1&page=1`,
  ]) {
    const t0 = Date.now();
    try {
      const r = await fetch(base, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      const txt = await r.text();
      console.log(id, r.status, Date.now() - t0, "ms", base.includes("tcgdex") ? "tcgdex" : "ptcg", txt.slice(0, 60));
    } catch (e) {
      console.log(id, "ERR", Date.now() - t0, e.name);
    }
  }
}
