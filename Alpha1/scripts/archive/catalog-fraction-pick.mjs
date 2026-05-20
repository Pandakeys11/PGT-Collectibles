/** Simulate pickFractionDisambiguated for misread SI cards */
async function fetchCards(name, num) {
  const query = `name:"${name}" number:"${num}"`;
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=48`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const j = await r.json();
  return j.data ?? [];
}

function pick(hits, den, num) {
  const byTotal = hits.filter((h) => {
    const pt = h.set?.printedTotal;
    const tot = h.set?.total;
    const n = (h.number ?? "").trim();
    const head = n.split("/")[0]?.trim();
    return (pt === den || tot === den) && (n === num || head === num);
  });
  return byTotal.map((h) => `${h.name} ${h.number} | ${h.set?.name} (${h.set?.printedTotal})`);
}

const scenarios = [
  ["Butterfree", "3", 18],
  ["Butterfree", "9", 18],
  ["Lapras", "12", 18],
  ["Ivysaur", "5", 18],
  ["Vileplume", "3", 18],
  ["Vileplume", "17", 18],
];

for (const [name, num, den] of scenarios) {
  const hits = await fetchCards(name, num);
  const picked = pick(hits, den, num);
  console.log(`\n${name} #${num} /${den} → ${picked.length ? picked[0] : "NO MATCH"} (${hits.length} raw hits)`);
}
