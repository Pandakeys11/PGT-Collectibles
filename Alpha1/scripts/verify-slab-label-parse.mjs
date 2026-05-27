import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const sourcePath = path.join(process.cwd(), "src", "lib", "scan", "slab-label-parse.ts");
const source = readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
});

const sandbox = { exports: {}, module: { exports: {} }, require, console };
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(transpiled.outputText, sandbox, { filename: sourcePath });

const { parseStructuredSlabLabel } = sandbox.module.exports;

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

const cases = [
  {
    label: "2000 POKEMON GAME BLASTOISE-HOLO BASE II #2 EX 5",
    want: { name: "Blastoise", set: "Base Set 2", number: "2", year: "2000" },
  },
  {
    label: "1999 P.M. JAPANESE GYM 2 BLAINE'S CHARIZARD HOLO #6 EX 5",
    want: { name: "Blaine's Charizard", set: "Gym Challenge", number: undefined, language: "Japanese" },
    includes: { details: "Slab local number retained from label: #6" },
  },
  {
    label: "2003 POKEMON E-CARD MACHAMP SKYRIDGE #16 NM-MT+ 8.5",
    want: { name: "Machamp", set: "Skyridge", number: "16", year: "2003" },
  },
  {
    label: "1999 TOPPS POKEMON CHARIZARD #E6 MOVIE EDITION NM-MT 8",
    want: { name: "Charizard", set: "Pokemon non-TCG collectible", details: "Pokemon non-TCG collectible" },
  },
  {
    label: "2000 P.M. JAPANESE NEO 3 PORYGON2-HOLO #233 MINT 9",
    want: { name: "Porygon2", set: "Neo Revelation", number: undefined, language: "Japanese" },
    includes: { details: "Slab local number retained from label: #233" },
  },
];

for (const { label, want, includes } of cases) {
  const got = parseStructuredSlabLabel(label);
  for (const [key, value] of Object.entries(want)) {
    assertEqual(got[key], value, `${label} ${key}`);
  }
  for (const [key, value] of Object.entries(includes ?? {})) {
    if (!String(got[key] ?? "").includes(value)) {
      throw new Error(`${label} ${key}: expected to include ${value}, got ${got[key]}`);
    }
  }
}

console.log("Slab label parse checks passed.");
