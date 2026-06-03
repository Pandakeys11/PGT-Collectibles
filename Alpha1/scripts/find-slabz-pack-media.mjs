const html = await (await fetch("https://slabz.com")).text();
for (const needle of ["pokemon_50", "pokemon-50", "one-piece", "gifs"]) {
  let idx = 0;
  let n = 0;
  while ((idx = html.indexOf(needle, idx)) !== -1 && n < 8) {
    console.log(needle, "→", html.slice(Math.max(0, idx - 60), idx + 80).replace(/\s+/g, " "));
    idx += needle.length;
    n++;
  }
}

const chunks = [...new Set([...html.matchAll(/\/_next\/static\/[^"']+/gi)].map((m) => m[0]))];
for (const chunk of chunks) {
  if (!chunk.includes("media") && !chunk.includes("pack")) continue;
  console.log("chunk", chunk);
}
