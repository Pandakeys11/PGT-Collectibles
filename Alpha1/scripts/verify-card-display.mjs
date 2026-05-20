/**
 * Assert multilingual display helpers (mirrors src/lib/scan/card-display.ts).
 * Run: node scripts/verify-card-display.mjs
 */

function normalizeCardLanguage(language) {
  return (language ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isNonEnglishLanguage(language) {
  const lang = normalizeCardLanguage(language);
  if (!lang) return false;
  return lang !== "en" && lang !== "english" && lang !== "eng";
}

function readPrintedName(card) {
  return (card.printedName ?? card.printed_name ?? "").trim();
}

function readName(card) {
  return (card.name ?? "").trim();
}

function namesEquivalent(a, b) {
  if (!a || !b) return false;
  return normalizeCardLanguage(a) === normalizeCardLanguage(b);
}

function getCardDisplayTitle(card) {
  const english = readName(card);
  const printed = readPrintedName(card);
  const lang = (card.language ?? "").trim();
  if (printed && isNonEnglishLanguage(lang)) return printed;
  if (printed && english && !namesEquivalent(printed, english)) return printed;
  return english || printed || "—";
}

function getCardDisplaySubtitle(card) {
  const title = getCardDisplayTitle(card);
  const english = readName(card);
  const lang = (card.language ?? "").trim();
  const parts = [];
  if (english && !namesEquivalent(title, english)) parts.push(english);
  if (lang && isNonEnglishLanguage(lang)) parts.push(lang);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const cases = [
  {
    card: { name: "Charizard", printedName: "Glurak", language: "German" },
    title: "Glurak",
    subtitle: "Charizard · German",
  },
  {
    card: { name: "Charizard", printedName: "Charizard", language: "English" },
    title: "Charizard",
    subtitle: null,
  },
  {
    card: { name: "Glurak", printedName: "Glurak", language: "German" },
    title: "Glurak",
    subtitle: "German",
  },
];

let failed = 0;
for (const { card, title, subtitle } of cases) {
  const gotTitle = getCardDisplayTitle(card);
  const gotSubtitle = getCardDisplaySubtitle(card);
  if (gotTitle !== title || gotSubtitle !== subtitle) {
    failed += 1;
    console.error("FAIL", card, { want: { title, subtitle }, got: { title: gotTitle, subtitle: gotSubtitle } });
  } else {
    console.log("OK", gotTitle, gotSubtitle ?? "(no subtitle)");
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log("\nAll card-display checks passed.");
