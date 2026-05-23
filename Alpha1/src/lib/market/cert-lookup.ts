import { searchWeb, type WebSearchResult } from "@/lib/market/web-search";
import type { RegistrySnapshot } from "@/lib/scan/verification";

export type ParsedCertRef = {
  grader: string;
  cert: string;
};

const CERT_LINE =
  /\b(PSA|BGS|Beckett|CGC|SGC|TAG|ACE)\s*#?\s*(\d{6,12})\b/gi;

export function parseCertRefsFromText(text: string): ParsedCertRef[] {
  const seen = new Set<string>();
  const out: ParsedCertRef[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(CERT_LINE.source, CERT_LINE.flags);
  while ((match = re.exec(text)) !== null) {
    const grader = normalizeGrader(match[1]);
    const cert = match[2].replace(/\D/g, "");
    if (cert.length < 6) continue;
    const key = `${grader}:${cert}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ grader, cert });
  }
  return out;
}

function normalizeGrader(raw: string): string {
  const h = raw.toLowerCase();
  if (h.includes("beckett") || h === "bgs") return "BGS";
  if (h.includes("cgc")) return "CGC";
  if (h.includes("sgc")) return "SGC";
  if (h.includes("tag")) return "TAG";
  if (h.includes("ace")) return "ACE";
  return "PSA";
}

export function buildRegistryUrl(grader: string, cert: string): string {
  const digits = cert.replace(/\D/g, "");
  const g = grader.toUpperCase();
  if (g === "PSA") return `https://www.psacard.com/cert/${digits}/psa`;
  if (g === "CGC") return `https://www.cgccards.com/certlookup/${digits}`;
  if (g === "BGS") return `https://www.beckett.com/grading/card-lookup?item_id=${digits}`;
  if (g === "SGC") return `https://sgccard.com/cert/${digits}`;
  return `https://www.psacard.com/cert/${digits}/psa`;
}

function parsePopulationFromHay(hay: string): string | null {
  const pop =
    hay.match(/population[:\s]*([\d,]+(?:\s*\/\s*[\d,]+)?)/i) ??
    hay.match(/pop[:\s]*([\d,]+)/i) ??
    hay.match(/(\d{1,3}(?:,\d{3})+)\s+(?:in\s+)?(?:this\s+)?grade/i);
  if (!pop) return null;
  return pop[0].replace(/\s+/g, " ").trim().slice(0, 120);
}

function parseGradeDateFromHay(hay: string): string | null {
  const iso = hay.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named = hay.match(
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})/i,
  );
  if (named) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const m = months[named[1].slice(0, 3).toLowerCase()];
    if (m) return `${named[3]}-${m}-${String(named[2]).padStart(2, "0")}`;
  }
  return null;
}

function parseCardNameFromHay(hay: string, grader: string): string | null {
  const certPage = hay.match(
    /(?:card|item|description)[:\s]+([A-Za-z0-9][\w\s.'\-/#]{4,80})/i,
  );
  if (certPage?.[1]) return certPage[1].trim().slice(0, 100);
  const psaLabel = hay.match(/PSA\s*(?:GEM\s*)?(?:MT\s*)?(\d+(?:\.\d+)?)\s+(.{4,80})/i);
  if (psaLabel?.[2] && grader === "PSA") return psaLabel[2].trim().slice(0, 100);
  return null;
}

function parseGradeFromHay(hay: string, grader: string): string | null {
  const g = hay.match(
    new RegExp(`${grader}\\s*#?\\s*\\d+[^\\n]{0,40}?((?:GEM\\s*)?(?:MT\\s*)?\\d+(?:\\.\\d+)?|PRISTINE\\s*10|BLACK\\s*LABEL)`, "i"),
  );
  if (g?.[1]) return g[1].trim();
  const simple = hay.match(/\b(PSA|BGS|CGC|SGC)\s*(\d+(?:\.\d+)?|10)\b/i);
  if (simple) return `${simple[1]} ${simple[2]}`;
  return null;
}

export type CertWebLookupResult = {
  registry: RegistrySnapshot;
  snippets: WebSearchResult[];
  populationNote: string | null;
  gradeDate: string | null;
};

export async function lookupCertViaWeb(ref: ParsedCertRef): Promise<CertWebLookupResult> {
  const registryUrl = buildRegistryUrl(ref.grader, ref.cert);
  const queries = [
    `site:psacard.com cert ${ref.cert}`,
    `${ref.grader} cert ${ref.cert} population grade`,
    `site:ebay.com sold ${ref.grader} ${ref.cert}`,
    `${ref.grader} ${ref.cert} card ladder sold`,
  ];

  const settled = await Promise.allSettled(
    queries.slice(0, 3).map((q) => searchWeb(q, 5)),
  );
  const snippets: WebSearchResult[] = [];
  for (const row of settled) {
    if (row.status === "fulfilled") snippets.push(...row.value);
  }

  const hay = snippets.map((s) => `${s.title} ${s.snippet}`).join("\n");
  const cardName = parseCardNameFromHay(hay, ref.grader);
  const grade = parseGradeFromHay(hay, ref.grader);
  const populationNote = parsePopulationFromHay(hay);
  const gradeDate = parseGradeDateFromHay(hay);

  const registry: RegistrySnapshot = {
    certNumber: ref.cert,
    cardName,
    grade,
    grader: ref.grader,
    registryUrl,
    isVerified: Boolean(cardName || grade || snippets.some((s) => s.url.includes("psacard.com/cert"))),
  };

  return { registry, snippets, populationNote, gradeDate };
}
