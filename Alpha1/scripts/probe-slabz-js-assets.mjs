const html = await (await fetch("https://slabz.com")).text();
const chunks = [...new Set([...html.matchAll(/\/_next\/static\/[^"']+\.js/gi)].map((m) => m[0]))];
const found = new Set();
for (const chunk of chunks) {
  const js = await (await fetch(`https://slabz.com${chunk}`)).text();
  for (const m of js.matchAll(/https?:\/\/[^"'\s]+\.(?:gif|webp|png|mp4)/gi)) found.add(m[0]);
  for (const m of js.matchAll(/["'](\/packs\/[^"']+)["']/gi)) found.add(m[1]);
}
console.log([...found].sort().join("\n"));
