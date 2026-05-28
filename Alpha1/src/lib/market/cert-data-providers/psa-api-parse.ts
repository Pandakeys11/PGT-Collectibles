/** Normalize PSA Public API `GetByCertNumber` JSON (PSACert wrapper). */

export type PsaCertApiPopulation = {
  gradeCounts: Array<{ grade: string; count: number; higher: number | null }>;
  totalPopulation: number | null;
  populationNote: string | null;
  specId: string | null;
};

function parseNum(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Extract grade ladder from PSACert object when present. */
export function parsePsaCertApiPayload(data: Record<string, unknown>): {
  psaCert: Record<string, unknown>;
  cardName: string | null;
  grade: string | null;
  gradeDate: string | null;
  population: PsaCertApiPopulation;
  isValid: boolean;
} {
  const psaCert =
    data.PSACert && typeof data.PSACert === "object"
      ? (data.PSACert as Record<string, unknown>)
      : data;

  const cardName = pickString(psaCert, [
    "Subject",
    "CardName",
    "cardName",
    "Brand",
    "Description",
  ]);
  const grade = pickString(psaCert, ["CardGrade", "Grade", "grade", "psaGrade"]);
  const gradeDate = pickString(psaCert, ["GradeDate", "gradeDate", "CertDate"]);

  const gradeCounts: PsaCertApiPopulation["gradeCounts"] = [];
  const gradeKeyRe = /^(?:grade|psa)\s*(\d{1,2}|auth)$/i;
  const popObj =
    psaCert.PopulationBreakdown && typeof psaCert.PopulationBreakdown === "object"
      ? (psaCert.PopulationBreakdown as Record<string, unknown>)
      : null;

  if (popObj) {
    for (const [key, val] of Object.entries(popObj)) {
      const m = key.match(gradeKeyRe) ?? key.match(/^(\d{1,2})$/);
      const gradeLabel = m ? (m[1] === "auth" ? "AUTH" : m[1]) : key;
      const count = parseNum(val);
      if (count != null) {
        gradeCounts.push({ grade: gradeLabel, count, higher: null });
      }
    }
  }

  for (const [key, val] of Object.entries(psaCert)) {
    const m = key.match(/^Grade(\d{1,2})$/i) ?? key.match(/^PopGrade(\d{1,2})$/i);
    if (!m) continue;
    const count = parseNum(val);
    if (count == null) continue;
    if (!gradeCounts.some((g) => g.grade === m[1])) {
      gradeCounts.push({ grade: m[1], count, higher: null });
    }
  }

  const popHigher = parseNum(psaCert.PopHigherGrade ?? psaCert.PopulationHigher);
  const popThisGrade = parseNum(
    psaCert.Population ?? psaCert.PopulationInGrade ?? psaCert.GradePopulation,
  );
  const totalPopulation = parseNum(
    psaCert.TotalPopulation ?? psaCert.TotalPop ?? psaCert.PopulationTotal,
  );

  if (popThisGrade != null && grade) {
    const g = grade.replace(/PSA\s*/i, "").trim() || "?";
    if (!gradeCounts.some((row) => row.grade === g)) {
      gradeCounts.push({
        grade: g,
        count: popThisGrade,
        higher: popHigher,
      });
    }
  }

  const noteParts: string[] = [];
  if (gradeCounts.length > 0) {
    for (const row of gradeCounts.sort((a, b) => Number(b.grade) - Number(a.grade))) {
      const higher = row.higher != null ? ` / ${row.higher.toLocaleString()}` : "";
      noteParts.push(`PSA ${row.grade}: ${row.count.toLocaleString()}${higher}`);
    }
  } else if (popThisGrade != null) {
    const higher = popHigher != null ? ` / ${popHigher.toLocaleString()}` : "";
    noteParts.push(`PSA population: ${popThisGrade.toLocaleString()}${higher}`);
  } else if (totalPopulation != null) {
    noteParts.push(`PSA total population: ${totalPopulation.toLocaleString()}`);
  }

  const specId =
    psaCert.SpecID != null
      ? String(psaCert.SpecID)
      : psaCert.SpecId != null
        ? String(psaCert.SpecId)
        : psaCert.specID != null
          ? String(psaCert.specID)
          : null;

  const serverOk =
    data.IsValidRequest === true ||
    data.ServerMessage === "Request successful" ||
    Boolean(cardName || grade);

  return {
    psaCert,
    cardName,
    grade,
    gradeDate,
    population: {
      gradeCounts,
      totalPopulation,
      populationNote: noteParts.length ? noteParts.join(" · ") : null,
      specId,
    },
    isValid: serverOk && Boolean(cardName || grade || noteParts.length),
  };
}
