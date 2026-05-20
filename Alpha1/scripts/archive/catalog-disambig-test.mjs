async function q(query, pageSize = 12) {
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=${pageSize}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`${r.status} ${query}`);
  const j = await r.json();
  return (j.data ?? []).map((c) => ({
    name: c.name,
    num: c.number,
    set: c.set?.name,
    printedTotal: c.set?.printedTotal,
    year: c.set?.releaseDate?.slice(0, 4),
  }));
}

const cases = [
  ["Butterfree + num 3", 'name:"Butterfree" number:"3"'],
  ["Butterfree + SI set", 'name:"Butterfree" set.name:"Southern Islands"'],
  ["Lapras + num 12", 'name:"Lapras" number:"12"'],
  ["Lapras + 12/18 style", 'name:"Lapras" number:"12"'],
  ["Ivysaur + num 5", 'name:"Ivysaur" number:"5"'],
  ["Vileplume + num 3", 'name:"Vileplume" number:"3"'],
  ["Dark Dragonite", 'name:"Dragonite"'],
];

for (const [label, query] of cases) {
  console.log(`\n=== ${label} ===`);
  const hits = await q(query);
  console.log(`hits: ${hits.length}`);
  for (const h of hits.slice(0, 8)) {
    console.log(`  ${h.name} ${h.num} | ${h.set} (${h.printedTotal}) ${h.year}`);
  }
}
