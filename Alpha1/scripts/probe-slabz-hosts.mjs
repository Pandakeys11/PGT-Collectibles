const hosts = [
  "https://app.slabz.com",
  "https://packz.slabz.com",
  "https://assets.slabz.com",
  "https://slabz.com",
];
const path = "/packs/gifs/pokemon_50.gif";
for (const h of hosts) {
  try {
    const r = await fetch(`${h}${path}`, { method: "HEAD", redirect: "follow" });
    console.log(r.status, `${h}${path}`);
  } catch (e) {
    console.log("err", h, e.cause?.code ?? e.message);
  }
}
