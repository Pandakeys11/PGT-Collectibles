const html = await (await fetch("https://slabz.com")).text();
const re =
  /\\"key\\":\\"(slabz_[^\\"]+)\\"[^}]*?\\"name\\":\\"([^\\"]+)\\"[^}]*?\\"imageUrl\\":\\"([^\\"]+)\\"[^}]*?\\"priceUsdCents\\":(\d+)/g;
let n = 0;
for (const m of html.matchAll(re)) {
  console.log(m[1], m[3], m[4]);
  n++;
}
console.log("count", n);
