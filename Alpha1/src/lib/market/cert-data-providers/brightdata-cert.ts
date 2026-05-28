import { buildRegistryUrl } from "@/lib/market/cert-lookup";
import type { ParsedCertRef } from "@/lib/market/cert-lookup";
import { isBrightDataPopHarvestEnabled } from "@/lib/market/brightdata/config";
import { fetchGraderPageContent } from "@/lib/market/brightdata/fetch-grader-page";
import {
  formatPopulationNoteForCert,
  parseGraderPopulationFromContent,
} from "@/lib/market/brightdata/pop-parse";
import type { CertDataProvider, CertLookupResult } from "@/lib/market/cert-data-providers/types";

function graderFromRef(ref: ParsedCertRef): "PSA" | "BGS" | "CGC" | null {
  const g = ref.grader.toUpperCase();
  if (g === "PSA" || g === "BGS" || g === "CGC") return g;
  return null;
}

function parseGradeDate(content: string): string | null {
  const iso = content.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function parseCardNameFromContent(content: string): string | null {
  const title = content.match(/^#\s+(.+)$/m)?.[1];
  if (title && title.length > 3) return title.slice(0, 120);
  const og = content.match(/(?:card|item)\s*name\s*[:\s]+([^\n|]+)/i)?.[1];
  return og?.trim().slice(0, 120) ?? null;
}

function parseGradeFromContent(content: string, grader: string): string | null {
  const m = content.match(new RegExp(`${grader}\\s*(\\d+(?:\\.\\d+)?|GEM\\s*MT|AUTH)`, "i"));
  return m ? `${grader} ${m[1]}`.trim().slice(0, 40) : null;
}

export const brightdataCertProvider: CertDataProvider = {
  id: "brightdata",
  isConfigured: () => isBrightDataPopHarvestEnabled(),

  async lookup(ref: ParsedCertRef): Promise<CertLookupResult | null> {
    const grader = graderFromRef(ref);
    if (!grader) return null;

    const cert = ref.cert.replace(/\D/g, "");
    const url = buildRegistryUrl(grader, cert);

    const page = await fetchGraderPageContent(url);
    if (!page?.content.trim()) return null;

    const parsed = parseGraderPopulationFromContent(grader, page.content, url);
    const cardName = parseCardNameFromContent(page.content);
    const grade = parseGradeFromContent(page.content, grader);
    const populationNote = parsed
      ? formatPopulationNoteForCert(parsed, grade)
      : null;

    const verified = Boolean(cardName || grade || populationNote);

    return {
      provider: "brightdata",
      gemrateId: null,
      populationNote,
      gradeDate: parseGradeDate(page.content),
      raw: {
        url,
        via: page.via,
        gradeCount: parsed?.grades.length ?? 0,
      },
      registry: {
        certNumber: cert,
        cardName,
        grade,
        grader,
        registryUrl: url,
        isVerified: verified,
      },
    };
  },
};
