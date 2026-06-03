const html = await (await fetch("https://slabz.com")).text();
const patterns = [
  /\/packs\/[^\"'\s)]+/gi,
  /https?:\/\/[^\"'\s)]+\.(?:gif|webp|png|mp4)/gi,
  /pokemon_\d+/gi,
  /one_piece_\d+/gi,
];
for (const re of patterns) {
  const hits = [...new Set([...html.matchAll(re)].map((m) => m[0]))].slice(0, 20);
  if (hits.length) console.log(re.source, hits);
}

const chunks = [...new Set([...html.matchAll(/\/_next\/static\/[^\"']+\.js/gi)].map((m) => m[0]))];
for (const chunk of chunks.slice(0, 8)) {
  const js = await (await fetch(`https://slabz.com${chunk}`)).text();
  for (const needle of ["gifs/", "packImage", "ripGif", "pokemon_50", ".webp", ".mp4"]) {
    let idx = 0;
    while ((idx = js.indexOf(needle, idx)) !== -1) {
      const slice = js.slice(Math.max(0, idx - 80), idx + 100);
      if (/\.(gif|webp|png|mp4|jpg)/i.test(slice) || needle.includes("gifs")) {
        console.log(chunk.slice(-40), "→", slice.replace(/\s+/g, " "));
      }
      idx += needle.length;
      if (idx > 500000) break;
    }
  }
}
