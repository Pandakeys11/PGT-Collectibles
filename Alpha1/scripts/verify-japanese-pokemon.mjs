import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadTsModule(relPath) {
  const sourcePath = path.join(process.cwd(), relPath);
  const source = readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const sandbox = { exports: {}, module: { exports: {} }, require, console };
  vm.runInNewContext(transpiled.outputText, sandbox, { filename: sourcePath });
  return { ...sandbox.exports, ...sandbox.module.exports };
}

const {
  normalizeJapanesePokemonIdentity,
  toCatalogCounterpartCard,
  japaneseMarketIdentityParts,
} = loadTsModule("src/lib/scan/japanese-pokemon.ts");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertIncludes(text, expected, message) {
  if (!String(text ?? "").includes(expected)) {
    throw new Error(`${message}: expected ${text} to include ${expected}`);
  }
}

const rawVintage = normalizeJapanesePokemonIdentity({
  franchise: "pokemon",
  name: "リザードン",
  printedName: "リザードン",
  language: "Japanese",
  set: "拡張パック",
  number: "No. 006",
  year: "",
});
assertEqual(rawVintage.name, "Charizard", "raw vintage display name");
assertEqual(rawVintage.japaneseName, "リザードン", "raw vintage Japanese name");
assertEqual(rawVintage.set, "Japanese Base Set", "raw vintage Japanese set");
assertEqual(rawVintage.setNameEnglish, "Base Set", "raw vintage counterpart set");
assertEqual(rawVintage.number, "No.006", "raw vintage number");
assertEqual(rawVintage.englishCounterpartNumber, "4/102", "raw vintage counterpart number");
assertEqual(rawVintage.matchMethod, "exact_japanese_name_number", "raw vintage match method");
assertEqual(rawVintage.japaneseMatchStatus, "confirmed", "raw vintage confidence status");

const catalogCard = toCatalogCounterpartCard(rawVintage);
assertEqual(catalogCard.name, "Charizard", "catalog counterpart name");
assertEqual(catalogCard.set, "Base Set", "catalog counterpart set");
assertEqual(catalogCard.number, "4/102", "catalog counterpart number");

const modern = normalizeJapanesePokemonIdentity({
  franchise: "pokemon",
  name: "リザードンex",
  printedName: "リザードンex",
  language: "Japanese",
  set: "ポケモンカード151",
  number: "006",
});
assertEqual(modern.name, "Charizard ex", "modern Japanese name mapping");
assertEqual(modern.number, "No.006", "modern Japanese no normalization");

const low = normalizeJapanesePokemonIdentity({
  franchise: "pokemon",
  name: "不明",
  printedName: "不明",
  language: "Japanese",
  set: "Unknown",
});
assertEqual(low.japaneseMatchStatus, "needs_manual_review", "low-confidence Japanese status");

const marketParts = japaneseMarketIdentityParts({
  ...rawVintage,
  grader: "PSA",
  grade: "10",
});
assertIncludes(marketParts.join(" "), "Japanese", "market query language");
assertIncludes(marketParts.join(" "), "リザードン", "market query Japanese name");
assertIncludes(marketParts.join(" "), "PSA 10", "market query grade");

console.log("Japanese Pokemon normalization checks passed.");
