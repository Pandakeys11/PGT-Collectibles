import {
  matchesBgsBlackLabel,
  matchesCgcPristine10,
  matchesPsa10,
} from "@/lib/market/grade-match";
import type { MarketEvidence } from "@/lib/scan/schemas";

export type GraderBrand =
  | "PSA"
  | "CGC"
  | "BGS"
  | "SGC"
  | "TAG"
  | "ACE"
  | "OTHER";

export type GradeTier =
  | "premium"
  | "gem"
  | "high"
  | "mid"
  | "low"
  | "auth"
  | "raw";

export type GraderBadgeStyle = {
  brand: GraderBrand;
  brandLabel: string;
  gradeDisplay: string;
  gradeNum: string | null;
  tier: GradeTier;
  qualifier: string | null;
  gemGradient: string;
  ringClass: string;
  chipClass: string;
  textClass: string;
  glowStyle: string;
};

type BadgeInput = {
  grader?: string | null;
  grade?: string | null;
  labelTitle?: string | null;
  title?: string | null;
  slab?: string | null;
};

function haystack(input: BadgeInput): string {
  return `${input.grader ?? ""} ${input.grade ?? ""} ${input.labelTitle ?? ""} ${input.title ?? ""} ${input.slab ?? ""}`.toLowerCase();
}

export function normalizeGraderBrand(grader?: string | null): GraderBrand {
  const g = (grader ?? "").toUpperCase();
  if (g.includes("PSA")) return "PSA";
  if (g.includes("CGC")) return "CGC";
  if (g.includes("BGS") || g.includes("BECKETT")) return "BGS";
  if (g.includes("SGC")) return "SGC";
  if (g.includes("TAG")) return "TAG";
  if (g.includes("ACE")) return "ACE";
  return "OTHER";
}

function parseGradeNumber(grade?: string | null): string | null {
  if (!grade?.trim() || grade === "—") return null;
  const m = grade.match(/(\d+(?:\.\d+)?)/);
  return m?.[1] ?? null;
}

function gradeTier(gradeNum: string | null, h: string): GradeTier {
  if (/authentic/i.test(h) && !gradeNum) return "auth";
  if (!gradeNum) return "raw";
  const n = Number.parseFloat(gradeNum);
  if (Number.isNaN(n)) return "raw";
  if (n >= 10 || /gem\s*mint|pristine|black\s*label/i.test(h)) {
    if (/black\s*label|pristine/i.test(h)) return "premium";
    return "gem";
  }
  if (n >= 9) return "high";
  if (n >= 7) return "mid";
  return "low";
}

function qualifierLabel(h: string): string | null {
  if (/black\s*label/i.test(h)) return "Black Label";
  if (/pristine/i.test(h)) return "Pristine";
  if (/gem\s*mint/i.test(h)) return "Gem Mint";
  if (/qualifier/i.test(h)) return "Qualifier";
  return null;
}

function asEvidence(input: BadgeInput): MarketEvidence {
  const slabText =
    input.slab ?? (`${input.grader ?? ""} ${input.grade ?? ""}`.trim() || null);
  return {
    kind: "reference",
    title: haystack(input),
    slab: slabText,
    source: null,
    priceUsd: null,
    observedAt: null,
    url: null,
  };
}

function brandPalette(
  brand: GraderBrand,
  tier: GradeTier,
): Pick<GraderBadgeStyle, "gemGradient" | "ringClass" | "chipClass" | "textClass" | "glowStyle"> {
  const palettes: Record<
    GraderBrand,
    Record<GradeTier, Pick<GraderBadgeStyle, "gemGradient" | "ringClass" | "chipClass" | "textClass" | "glowStyle">>
  > = {
    PSA: {
      premium: {
        gemGradient: "from-red-500 via-rose-300 to-red-700",
        ringClass: "ring-red-300/50",
        chipClass: "border-red-400/40 bg-red-500/20 text-red-100",
        textClass: "text-red-200",
        glowStyle: "0 0 20px rgba(239, 68, 68, 0.45)",
      },
      gem: {
        gemGradient: "from-red-500/95 via-rose-400/90 to-red-600/95",
        ringClass: "ring-red-400/40",
        chipClass: "border-red-500/35 bg-red-500/15 text-red-200",
        textClass: "text-red-200",
        glowStyle: "0 0 16px rgba(239, 68, 68, 0.35)",
      },
      high: {
        gemGradient: "from-red-600/80 via-rose-500/70 to-red-800/80",
        ringClass: "ring-red-500/25",
        chipClass: "border-red-500/25 bg-red-950/40 text-red-300/90",
        textClass: "text-red-300/90",
        glowStyle: "0 0 10px rgba(185, 28, 28, 0.25)",
      },
      mid: {
        gemGradient: "from-rose-900/80 via-red-900/70 to-rose-950/80",
        ringClass: "ring-red-900/30",
        chipClass: "border-red-900/30 bg-red-950/30 text-red-300/80",
        textClass: "text-red-300/80",
        glowStyle: "none",
      },
      low: {
        gemGradient: "from-rose-950 via-red-950 to-black",
        ringClass: "ring-red-950/40",
        chipClass: "border-red-950/40 bg-black/40 text-red-400/70",
        textClass: "text-red-400/70",
        glowStyle: "none",
      },
      auth: {
        gemGradient: "from-slate-600 via-slate-500 to-slate-700",
        ringClass: "ring-slate-400/30",
        chipClass: "border-slate-500/30 bg-slate-800/50 text-slate-300",
        textClass: "text-slate-300",
        glowStyle: "none",
      },
      raw: {
        gemGradient: "from-emerald-600/70 via-emerald-500/60 to-teal-700/70",
        ringClass: "ring-emerald-500/25",
        chipClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
        textClass: "text-emerald-300",
        glowStyle: "none",
      },
    },
    CGC: {
      premium: {
        gemGradient: "from-cyan-400 via-sky-300 to-indigo-500",
        ringClass: "ring-cyan-300/50",
        chipClass: "border-cyan-400/40 bg-cyan-500/20 text-cyan-100",
        textClass: "text-cyan-100",
        glowStyle: "0 0 20px rgba(34, 211, 238, 0.45)",
      },
      gem: {
        gemGradient: "from-sky-500/95 via-blue-400/90 to-indigo-600/95",
        ringClass: "ring-sky-400/40",
        chipClass: "border-sky-500/35 bg-sky-500/15 text-sky-100",
        textClass: "text-sky-200",
        glowStyle: "0 0 16px rgba(56, 189, 248, 0.35)",
      },
      high: {
        gemGradient: "from-sky-700/85 via-blue-600/75 to-indigo-800/85",
        ringClass: "ring-sky-500/25",
        chipClass: "border-sky-600/30 bg-sky-950/35 text-sky-200/90",
        textClass: "text-sky-200/90",
        glowStyle: "none",
      },
      mid: {
        gemGradient: "from-indigo-900/80 via-blue-950/70 to-slate-900/80",
        ringClass: "ring-indigo-800/30",
        chipClass: "border-indigo-800/30 bg-indigo-950/30 text-sky-300/75",
        textClass: "text-sky-300/75",
        glowStyle: "none",
      },
      low: {
        gemGradient: "from-slate-800 via-slate-900 to-black",
        ringClass: "ring-slate-700/30",
        chipClass: "border-slate-700/30 bg-black/40 text-slate-400",
        textClass: "text-slate-400",
        glowStyle: "none",
      },
      auth: {
        gemGradient: "from-slate-600 via-slate-500 to-slate-700",
        ringClass: "ring-slate-400/30",
        chipClass: "border-slate-500/30 bg-slate-800/50 text-slate-300",
        textClass: "text-slate-300",
        glowStyle: "none",
      },
      raw: {
        gemGradient: "from-emerald-600/70 via-emerald-500/60 to-teal-700/70",
        ringClass: "ring-emerald-500/25",
        chipClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
        textClass: "text-emerald-300",
        glowStyle: "none",
      },
    },
    BGS: {
      premium: {
        gemGradient: "from-amber-200 via-yellow-100 to-amber-500",
        ringClass: "ring-amber-200/55",
        chipClass: "border-amber-200/45 bg-amber-400/20 text-amber-950",
        textClass: "text-amber-100",
        glowStyle: "0 0 22px rgba(251, 191, 36, 0.5)",
      },
      gem: {
        gemGradient: "from-amber-300/95 via-yellow-200/90 to-amber-500/95",
        ringClass: "ring-amber-300/45",
        chipClass: "border-amber-400/35 bg-amber-500/15 text-amber-100",
        textClass: "text-amber-100",
        glowStyle: "0 0 16px rgba(245, 158, 11, 0.4)",
      },
      high: {
        gemGradient: "from-amber-600/85 via-yellow-600/75 to-amber-800/85",
        ringClass: "ring-amber-500/30",
        chipClass: "border-amber-600/30 bg-amber-950/35 text-amber-200/90",
        textClass: "text-amber-200/90",
        glowStyle: "none",
      },
      mid: {
        gemGradient: "from-amber-900/80 via-yellow-900/70 to-amber-950/80",
        ringClass: "ring-amber-900/30",
        chipClass: "border-amber-900/30 bg-amber-950/30 text-amber-300/75",
        textClass: "text-amber-300/75",
        glowStyle: "none",
      },
      low: {
        gemGradient: "from-yellow-950 via-amber-950 to-black",
        ringClass: "ring-amber-950/40",
        chipClass: "border-amber-950/40 bg-black/40 text-amber-400/70",
        textClass: "text-amber-400/70",
        glowStyle: "none",
      },
      auth: {
        gemGradient: "from-slate-600 via-slate-500 to-slate-700",
        ringClass: "ring-slate-400/30",
        chipClass: "border-slate-500/30 bg-slate-800/50 text-slate-300",
        textClass: "text-slate-300",
        glowStyle: "none",
      },
      raw: {
        gemGradient: "from-emerald-600/70 via-emerald-500/60 to-teal-700/70",
        ringClass: "ring-emerald-500/25",
        chipClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
        textClass: "text-emerald-300",
        glowStyle: "none",
      },
    },
    SGC: {
      premium: {
        gemGradient: "from-slate-200 via-slate-100 to-slate-400",
        ringClass: "ring-slate-200/50",
        chipClass: "border-slate-300/40 bg-slate-400/20 text-slate-900",
        textClass: "text-slate-100",
        glowStyle: "0 0 18px rgba(203, 213, 225, 0.35)",
      },
      gem: {
        gemGradient: "from-slate-300/95 via-slate-200/90 to-slate-500/95",
        ringClass: "ring-slate-300/40",
        chipClass: "border-slate-400/35 bg-slate-500/15 text-slate-100",
        textClass: "text-slate-200",
        glowStyle: "0 0 14px rgba(148, 163, 184, 0.3)",
      },
      high: {
        gemGradient: "from-slate-600/85 via-slate-500/75 to-slate-700/85",
        ringClass: "ring-slate-500/25",
        chipClass: "border-slate-600/30 bg-slate-900/40 text-slate-300",
        textClass: "text-slate-300",
        glowStyle: "none",
      },
      mid: {
        gemGradient: "from-slate-800 via-slate-900 to-black",
        ringClass: "ring-slate-700/30",
        chipClass: "border-slate-700/30 bg-black/40 text-slate-400",
        textClass: "text-slate-400",
        glowStyle: "none",
      },
      low: {
        gemGradient: "from-slate-900 via-black to-black",
        ringClass: "ring-slate-800/30",
        chipClass: "border-slate-800/30 bg-black/40 text-slate-500",
        textClass: "text-slate-500",
        glowStyle: "none",
      },
      auth: {
        gemGradient: "from-slate-600 via-slate-500 to-slate-700",
        ringClass: "ring-slate-400/30",
        chipClass: "border-slate-500/30 bg-slate-800/50 text-slate-300",
        textClass: "text-slate-300",
        glowStyle: "none",
      },
      raw: {
        gemGradient: "from-emerald-600/70 via-emerald-500/60 to-teal-700/70",
        ringClass: "ring-emerald-500/25",
        chipClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
        textClass: "text-emerald-300",
        glowStyle: "none",
      },
    },
    TAG: {
      premium: {
        gemGradient: "from-violet-400 via-fuchsia-400 to-purple-600",
        ringClass: "ring-violet-300/45",
        chipClass: "border-violet-400/35 bg-violet-500/20 text-violet-100",
        textClass: "text-violet-200",
        glowStyle: "0 0 18px rgba(167, 139, 250, 0.4)",
      },
      gem: {
        gemGradient: "from-violet-500 via-fuchsia-500 to-purple-700",
        ringClass: "ring-violet-400/35",
        chipClass: "border-violet-500/30 bg-violet-500/15 text-violet-200",
        textClass: "text-violet-200",
        glowStyle: "0 0 14px rgba(139, 92, 246, 0.35)",
      },
      high: {
        gemGradient: "from-violet-800 via-purple-900 to-violet-950",
        ringClass: "ring-violet-700/30",
        chipClass: "border-violet-700/30 bg-violet-950/35 text-violet-300/85",
        textClass: "text-violet-300/85",
        glowStyle: "none",
      },
      mid: {
        gemGradient: "from-purple-950 to-black",
        ringClass: "ring-purple-900/30",
        chipClass: "border-purple-900/30 bg-black/40 text-violet-400/70",
        textClass: "text-violet-400/70",
        glowStyle: "none",
      },
      low: {
        gemGradient: "from-purple-950 to-black",
        ringClass: "ring-purple-950/30",
        chipClass: "border-purple-950/30 bg-black/40 text-violet-500/60",
        textClass: "text-violet-500/60",
        glowStyle: "none",
      },
      auth: {
        gemGradient: "from-slate-600 via-slate-500 to-slate-700",
        ringClass: "ring-slate-400/30",
        chipClass: "border-slate-500/30 bg-slate-800/50 text-slate-300",
        textClass: "text-slate-300",
        glowStyle: "none",
      },
      raw: {
        gemGradient: "from-emerald-600/70 via-emerald-500/60 to-teal-700/70",
        ringClass: "ring-emerald-500/25",
        chipClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
        textClass: "text-emerald-300",
        glowStyle: "none",
      },
    },
    ACE: {
      premium: {
        gemGradient: "from-orange-400 via-amber-300 to-orange-600",
        ringClass: "ring-orange-300/40",
        chipClass: "border-orange-400/35 bg-orange-500/15 text-orange-100",
        textClass: "text-orange-200",
        glowStyle: "0 0 16px rgba(251, 146, 60, 0.35)",
      },
      gem: {
        gemGradient: "from-orange-500 via-amber-400 to-orange-700",
        ringClass: "ring-orange-400/35",
        chipClass: "border-orange-500/30 bg-orange-500/15 text-orange-100",
        textClass: "text-orange-200",
        glowStyle: "none",
      },
      high: {
        gemGradient: "from-orange-800 via-amber-900 to-orange-950",
        ringClass: "ring-orange-700/30",
        chipClass: "border-orange-800/30 bg-orange-950/35 text-orange-300/85",
        textClass: "text-orange-300/85",
        glowStyle: "none",
      },
      mid: {
        gemGradient: "from-orange-950 to-black",
        ringClass: "ring-orange-900/30",
        chipClass: "border-orange-900/30 bg-black/40 text-orange-400/70",
        textClass: "text-orange-400/70",
        glowStyle: "none",
      },
      low: {
        gemGradient: "from-orange-950 to-black",
        ringClass: "ring-orange-950/30",
        chipClass: "border-orange-950/30 bg-black/40 text-orange-500/60",
        textClass: "text-orange-500/60",
        glowStyle: "none",
      },
      auth: {
        gemGradient: "from-slate-600 via-slate-500 to-slate-700",
        ringClass: "ring-slate-400/30",
        chipClass: "border-slate-500/30 bg-slate-800/50 text-slate-300",
        textClass: "text-slate-300",
        glowStyle: "none",
      },
      raw: {
        gemGradient: "from-emerald-600/70 via-emerald-500/60 to-teal-700/70",
        ringClass: "ring-emerald-500/25",
        chipClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
        textClass: "text-emerald-300",
        glowStyle: "none",
      },
    },
    OTHER: {
      premium: {
        gemGradient: "from-fuchsia-500 via-pink-400 to-violet-600",
        ringClass: "ring-fuchsia-400/35",
        chipClass: "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-200",
        textClass: "text-fuchsia-200",
        glowStyle: "0 0 14px rgba(217, 70, 239, 0.35)",
      },
      gem: {
        gemGradient: "from-fuchsia-500/90 via-pink-400/85 to-violet-600/90",
        ringClass: "ring-fuchsia-400/35",
        chipClass: "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-200",
        textClass: "text-fuchsia-200",
        glowStyle: "none",
      },
      high: {
        gemGradient: "from-fuchsia-900/80 via-violet-900/70 to-purple-950/80",
        ringClass: "ring-fuchsia-800/30",
        chipClass: "border-fuchsia-800/30 bg-fuchsia-950/30 text-fuchsia-300/80",
        textClass: "text-fuchsia-300/80",
        glowStyle: "none",
      },
      mid: {
        gemGradient: "from-violet-950 to-black",
        ringClass: "ring-violet-900/30",
        chipClass: "border-violet-900/30 bg-black/40 text-fuchsia-400/70",
        textClass: "text-fuchsia-400/70",
        glowStyle: "none",
      },
      low: {
        gemGradient: "from-violet-950 to-black",
        ringClass: "ring-violet-950/30",
        chipClass: "border-violet-950/30 bg-black/40 text-fuchsia-500/60",
        textClass: "text-fuchsia-500/60",
        glowStyle: "none",
      },
      auth: {
        gemGradient: "from-slate-600 via-slate-500 to-slate-700",
        ringClass: "ring-slate-400/30",
        chipClass: "border-slate-500/30 bg-slate-800/50 text-slate-300",
        textClass: "text-slate-300",
        glowStyle: "none",
      },
      raw: {
        gemGradient: "from-emerald-600/70 via-emerald-500/60 to-teal-700/70",
        ringClass: "ring-emerald-500/25",
        chipClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
        textClass: "text-emerald-300",
        glowStyle: "none",
      },
    },
  };

  return palettes[brand][tier];
}

export function resolveGraderBadge(input: BadgeInput): GraderBadgeStyle {
  const h = haystack(input);
  const brand = normalizeGraderBrand(input.grader);
  const brandLabel =
    brand === "OTHER" ? (input.grader?.trim().toUpperCase() || "GRADED") : brand;
  const gradeNum = parseGradeNumber(input.grade);
  let tier = gradeTier(gradeNum, h);

  const evidence = asEvidence(input);
  if (matchesPsa10(evidence) || matchesBgsBlackLabel(evidence) || matchesCgcPristine10(evidence)) {
    tier = "premium";
  }

  const qualifier = qualifierLabel(h);
  const palette = brandPalette(brand, tier);

  let gradeDisplay = gradeNum ?? "—";
  if (qualifier && gradeNum) gradeDisplay = `${gradeNum} · ${qualifier}`;
  else if (qualifier) gradeDisplay = qualifier;
  else if (tier === "auth") gradeDisplay = "Auth";
  else if (tier === "raw") gradeDisplay = "Raw";

  return {
    brand,
    brandLabel,
    gradeDisplay,
    gradeNum,
    tier,
    qualifier,
    ...palette,
  };
}

export function resolveGraderBadgeFromCardMatch(card: {
  graded?: { company?: string; grade?: string; cert?: string } | null;
  extractedCard?: { grader?: string; grade?: string; labelTitle?: string } | null;
}): GraderBadgeStyle {
  const ex = card.extractedCard;
  return resolveGraderBadge({
    grader: card.graded?.company ?? ex?.grader,
    grade: card.graded?.grade ?? ex?.grade,
    labelTitle: ex?.labelTitle,
    slab: card.graded?.cert,
  });
}
