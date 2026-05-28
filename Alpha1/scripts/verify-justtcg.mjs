import fs from "node:fs";
import path from "node:path";
import { isJustTcgConfigured, justTcgGetCards } from "./lib/justtcg-client.mjs";
import { justTcgCardHasPrices } from "./lib/justtcg-price-snapshot.mjs";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

if (!isJustTcgConfigured()) {
  console.error("JUSTTCG_API_KEY missing — add to .env.local");
  process.exit(1);
}

const result = await justTcgGetCards({
  game: "Magic: The Gathering",
  search: "Lightning Bolt",
  limit: 1,
});

console.log("status", result.error ?? "ok");
console.log("usage", result.usage);
const card = result.cards[0];
if (!card) {
  console.log("no card returned");
  process.exit(0);
}

console.log("card", card.name, card.set, card.number, "tcgplayerId", card.tcgplayerId);
console.log("variants", card.variants?.length ?? 0);
console.log("hasPrices", justTcgCardHasPrices(card));
if (card.variants?.[0]) {
  console.log("sampleVariant", card.variants[0]);
}
