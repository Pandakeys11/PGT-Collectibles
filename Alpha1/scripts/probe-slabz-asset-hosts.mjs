const ccTypes = ["pokemon_25", "pokemon_50", "pokemon_250", "pokemon_1000", "one-piece_250", "one_piece_250"];
const bases = [
  "https://slabz.com",
  "https://api-staging-3e2d.up.railway.app",
  "https://api-staging-3e2d.up.railway.app/api/partner/v1",
];
const paths = (cc) => [
  `/packs/gifs/${cc}.gif`,
  `/packs/gifs/${cc}.webp`,
  `/packs/${cc}.png`,
  `/packs/${cc}/image`,
  `/assets/packs/gifs/${cc}.gif`,
  `/static/packs/${cc}.webp`,
];

for (const base of bases) {
  for (const cc of ccTypes) {
    for (const path of paths(cc)) {
      const url = `${base.replace(/\/$/, "")}${path}`;
      try {
        const r = await fetch(url, { method: "HEAD", redirect: "follow" });
        if (r.ok) console.log(r.status, r.headers.get("content-type"), url);
      } catch {
        /* ignore */
      }
    }
  }
}
