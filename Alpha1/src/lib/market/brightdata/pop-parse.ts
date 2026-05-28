/** Parse grader population tables from Bright Data markdown / HTML. */

export type ParsedGradePopulation = {
  grade: string;
  populationCount: number;
  populationHigher: number | null;
};

export type ParsedGraderPopulation = {
  grader: "PSA" | "BGS" | "CGC";
  grades: ParsedGradePopulation[];
  totalPopulation: number | null;
  sourceUrl: string | null;
  rawNote: string | null;
};

const PSA_GRADE_ORDER = ["10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "AUTH"];

function parseCount(raw: string): number | null {
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizePsaGradeLabel(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  if (/^AUTH/.test(t)) return "AUTH";
  const m = t.match(/^(?:PSA\s*)?(\d{1,2})(?:\.\d)?/);
  if (m) return m[1];
  if (t === "GEM MT" || t === "GEM MINT" || t === "10") return "10";
  return null;
}

/** PSA pop matrix: "10" column with "1,234 / 5,678" or markdown table rows. */
export function parsePsaPopulationFromText(
  content: string,
  sourceUrl?: string | null,
): ParsedGraderPopulation | null {
  if (!content.trim()) return null;

  const grades = new Map<string, ParsedGradePopulation>();

  const slashCells =
    content.matchAll(
      /(?:^|\s)(?:PSA\s*)?(10|9|8|7|6|5|4|3|2|1|AUTH)\s*[:\|]?\s*([\d,]+)\s*\/\s*([\d,]+)/gim,
    );
  for (const m of slashCells) {
    const grade = normalizePsaGradeLabel(m[1]);
    if (!grade) continue;
    const count = parseCount(m[2]);
    const higher = parseCount(m[3]);
    if (count == null) continue;
    grades.set(grade, { grade, populationCount: count, populationHigher: higher });
  }

  const tableRows = content.matchAll(
    /\|\s*(?:PSA\s*)?(10|9|8|7|6|5|4|3|2|1|AUTH|GEM\s*MT)\s*\|\s*([\d,]+)(?:\s*\/\s*([\d,]+))?\s*\|/gi,
  );
  for (const m of tableRows) {
    const grade = normalizePsaGradeLabel(m[1]);
    if (!grade) continue;
    const count = parseCount(m[2]);
    if (count == null) continue;
    const higher = m[3] ? parseCount(m[3]) : null;
    grades.set(grade, { grade, populationCount: count, populationHigher: higher });
  }

  const labeled = content.matchAll(
    /(?:Grade\s*|PSA\s*)(10|9|8|7|6|5|4|3|2|1)\s*[:\-]?\s*([\d,]+)(?:\s*\/\s*([\d,]+))?/gi,
  );
  for (const m of labeled) {
    const grade = normalizePsaGradeLabel(m[1]);
    if (!grade) continue;
    const count = parseCount(m[2]);
    if (count == null) continue;
    grades.set(grade, {
      grade,
      populationCount: count,
      populationHigher: m[3] ? parseCount(m[3]) : null,
    });
  }

  const jsonPop = content.match(/"grade10"\s*:\s*(\d+)/i);
  if (jsonPop && !grades.has("10")) {
    const g10 = parseCount(jsonPop[1]);
    if (g10 != null) grades.set("10", { grade: "10", populationCount: g10, populationHigher: null });
  }
  const jsonPop9 = content.match(/"grade9"\s*:\s*(\d+)/i);
  if (jsonPop9 && !grades.has("9")) {
    const g9 = parseCount(jsonPop9[1]);
    if (g9 != null) grades.set("9", { grade: "9", populationCount: g9, populationHigher: null });
  }

  const totalM = content.match(/(?:total\s*population|total\s*graded|total)\s*[:\s]*([\d,]+)/i);
  const totalPopulation = totalM ? parseCount(totalM[1]) : null;

  if (grades.size === 0 && totalPopulation == null) {
    const single = content.match(/population\s*(?:in\s*)?(?:this\s*)?grade\s*[:\s]*([\d,]+(?:\s*\/\s*[\d,]+)?)/i);
    if (single) {
      const parts = single[1].split("/").map((p) => parseCount(p));
      if (parts[0] != null) {
        grades.set("?", {
          grade: "?",
          populationCount: parts[0],
          populationHigher: parts[1] ?? null,
        });
      }
    }
  }

  if (grades.size === 0) return null;

  const ordered = PSA_GRADE_ORDER.filter((g) => grades.has(g)).map((g) => grades.get(g)!);
  for (const [g, row] of grades) {
    if (!PSA_GRADE_ORDER.includes(g) && g !== "?") ordered.push(row);
  }

  const noteParts = ordered.map((r) => {
    const higher =
      r.populationHigher != null ? ` / ${r.populationHigher.toLocaleString()}` : "";
    return `PSA ${r.grade}: ${r.populationCount.toLocaleString()}${higher}`;
  });

  return {
    grader: "PSA",
    grades: ordered.filter((r) => r.grade !== "?"),
    totalPopulation,
    sourceUrl: sourceUrl ?? null,
    rawNote: noteParts.length ? `PSA population — ${noteParts.join(" · ")}` : null,
  };
}

export function parseBgsPopulationFromText(
  content: string,
  sourceUrl?: string | null,
): ParsedGraderPopulation | null {
  const grades = new Map<string, ParsedGradePopulation>();
  const patterns = content.matchAll(
    /(?:BGS|Grade)\s*(10|9\.5|9|8\.5|8|7\.5|7|6|5|4|3|2|1|Black\s*Label)\s*[:\|]?\s*([\d,]+)/gi,
  );
  for (const m of patterns) {
    const grade = m[1].replace(/\s+/g, " ");
    const count = parseCount(m[2]);
    if (count == null) continue;
    grades.set(grade, { grade, populationCount: count, populationHigher: null });
  }
  if (grades.size === 0) return null;
  return {
    grader: "BGS",
    grades: [...grades.values()],
    totalPopulation: null,
    sourceUrl: sourceUrl ?? null,
    rawNote: [...grades.values()]
      .map((r) => `BGS ${r.grade}: ${r.populationCount.toLocaleString()}`)
      .join(" · "),
  };
}

export function parseCgcPopulationFromText(
  content: string,
  sourceUrl?: string | null,
): ParsedGraderPopulation | null {
  const grades = new Map<string, ParsedGradePopulation>();
  const patterns = content.matchAll(
    /(?:CGC|Grade)\s*(10\s*Pristine|10|9\.5|9|8\.5|8|7|6|5|4|3|2|1)\s*[:\|]?\s*([\d,]+)/gi,
  );
  for (const m of patterns) {
    const grade = m[1].trim();
    const count = parseCount(m[2]);
    if (count == null) continue;
    grades.set(grade, { grade, populationCount: count, populationHigher: null });
  }
  if (grades.size === 0) return null;
  return {
    grader: "CGC",
    grades: [...grades.values()],
    totalPopulation: null,
    sourceUrl: sourceUrl ?? null,
    rawNote: [...grades.values()]
      .map((r) => `CGC ${r.grade}: ${r.populationCount.toLocaleString()}`)
      .join(" · "),
  };
}

export function parseGraderPopulationFromContent(
  grader: "PSA" | "BGS" | "CGC",
  content: string,
  sourceUrl?: string | null,
): ParsedGraderPopulation | null {
  if (grader === "PSA") return parsePsaPopulationFromText(content, sourceUrl);
  if (grader === "BGS") return parseBgsPopulationFromText(content, sourceUrl);
  return parseCgcPopulationFromText(content, sourceUrl);
}

/** Format population note for cert enrich (single slab grade context). */
export function formatPopulationNoteForCert(
  parsed: ParsedGraderPopulation,
  slabGrade?: string | null,
): string | null {
  if (parsed.rawNote?.trim()) return parsed.rawNote.trim().slice(0, 240);
  if (!slabGrade) return null;
  const norm = slabGrade.replace(/PSA\s*/i, "").trim();
  const row = parsed.grades.find((g) => g.grade === norm || g.grade.startsWith(norm));
  if (!row) return null;
  const higher =
    row.populationHigher != null ? ` / ${row.populationHigher.toLocaleString()}` : "";
  return `${parsed.grader} ${row.grade} pop ${row.populationCount.toLocaleString()}${higher}`;
}
