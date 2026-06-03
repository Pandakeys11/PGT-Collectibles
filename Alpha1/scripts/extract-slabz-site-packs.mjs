const html = await (await fetch("https://slabz.com")).text();
const keys = [...new Set([...html.matchAll(/slabz_pokemon_\d+/g)].map((m) => m[0]))];
console.log("keys", keys);
const imgs = [...new Set([...html.matchAll(/imageUrl\\":\\"([^\\"]+)\\"/g)].map((m) => m[1]))];
console.log("imageUrls", imgs);

// one-piece
const onePiece = [...html.matchAll(/one-piece[^\\"]*\.gif/gi)].map((m) => m[0]);
console.log("onePiece", [...new Set(onePiece)]);
