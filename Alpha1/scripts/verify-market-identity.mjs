import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import process from "node:process";
import ts from "typescript";

const require = createRequire(import.meta.url);
const sourcePath = path.join(process.cwd(), "src", "lib", "market", "market-evidence-identity.ts");
const source = readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
});

const sandbox = {
  exports: {},
  module: { exports: {} },
  require,
  console,
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(transpiled.outputText, sandbox, { filename: sourcePath });

const {
  filterMarketEvidenceForCardIdentity,
  getCardNumberEvidence,
  scoreMarketEvidenceIdentity,
  textIncludesCardNumber,
} = sandbox.module.exports;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const card = {
  name: "Charizard",
  set: "Base Set",
  number: "4/102",
  year: "1999",
  language: "English",
};

assert(textIncludesCardNumber("1999 Pokemon Charizard Base Set 4/102 PSA 9", "4/102"), "full card number should match");
assert(!textIncludesCardNumber("1999 Pokemon Charizard Base Set #4 PSA 9", "4/102"), "bare #4 should not be strong for 4/102");
assert(getCardNumberEvidence("1999 Pokemon Charizard Base Set #4 PSA 9", "4/102").level === "prefixOnly", "bare #4 should be prefix-only");
assert(getCardNumberEvidence("1999 Pokemon Charizard Base Set 5/102 PSA 9", "4/102").level === "conflict", "wrong fraction should conflict");

const correct = scoreMarketEvidenceIdentity(
  { title: "1999 Pokemon Charizard Base Set 4/102 PSA 9", slab: "PSA 9", source: "eBay" },
  card,
);
assert(correct.score >= 0.7, `correct evidence should score high, got ${correct.score}`);

const noNumber = scoreMarketEvidenceIdentity(
  { title: "1999 Pokemon Charizard Base Set Holo PSA 9 Mint", slab: "PSA 9", source: "eBay" },
  card,
);
assert(noNumber.score >= 0.65, `same name/set title without number should still be usable, got ${noNumber.score}`);

const wrongNumber = scoreMarketEvidenceIdentity(
  { title: "1999 Pokemon Charizard Base Set 5/102 PSA 9", slab: "PSA 9", source: "eBay" },
  card,
);
assert(wrongNumber.hardReject, "wrong card number should hard reject");

const filtered = filterMarketEvidenceForCardIdentity(
  [
    { kind: "sold", title: "1999 Pokemon Charizard Base Set 4/102 PSA 9", priceUsd: 1000, observedAt: null, url: null, source: "eBay", slab: "PSA 9" },
    { kind: "sold", title: "1999 Pokemon Charizard Base Set 5/102 PSA 9", priceUsd: 50, observedAt: null, url: null, source: "eBay", slab: "PSA 9" },
    { kind: "sold", title: "2016 Pokemon Evolutions Charizard Holo PSA 9", priceUsd: 80, observedAt: null, url: null, source: "eBay", slab: "PSA 9" },
  ],
  card,
);
assert(filtered.length === 1, `conflicting/derivative evidence should be removed, got ${filtered.length}`);

console.log("Market identity checks passed.");
