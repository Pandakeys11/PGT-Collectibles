const set = await (await fetch("https://api.tcgdex.net/v2/en/sets/sv01")).json();
console.log("sv01", { id: set.id, tcgOnline: set.tcgOnline, releaseDate: set.releaseDate });
const card = await (await fetch("https://api.tcgdex.net/v2/en/cards/sv01-001")).json();
console.log("card", card.id, card.name, card.rarity, card.pricing, card.tcgplayer);
