import type { LiquidAskComp } from "@/lib/scanner-chat/liquid-ask-types";

function sourceRank(source: string | null): number {
  const s = (source ?? "").toLowerCase();
  if (s.includes("ebay") && !s.includes("pricecharting")) return 0;
  if (s.includes("pricecharting")) return 1;
  if (s.includes("ebay")) return 2;
  if (s.includes("card ladder")) return 4;
  if (s === "alt") return 5;
  if (s.includes("goldin")) return 6;
  if (s.includes("tcgplayer")) return 7;
  return 8;
}

function kindRank(kind: LiquidAskComp["kind"]): number {
  if (kind === "sold") return 0;
  if (kind === "active") return 1;
  return 2;
}

export function sortCompsForDisplay(comps: LiquidAskComp[]): LiquidAskComp[] {
  return [...comps].sort((a, b) => {
    const sr = sourceRank(a.source) - sourceRank(b.source);
    if (sr !== 0) return sr;
    const kr = kindRank(a.kind) - kindRank(b.kind);
    if (kr !== 0) return kr;
    const pa = a.priceUsd ?? 0;
    const pb = b.priceUsd ?? 0;
    return pb - pa;
  });
}

export function partitionComps(comps: LiquidAskComp[]): {
  ebaySold: LiquidAskComp[];
  priceChartingSold: LiquidAskComp[];
  ebayActive: LiquidAskComp[];
  otherSold: LiquidAskComp[];
  otherActive: LiquidAskComp[];
  reference: LiquidAskComp[];
} {
  const sorted = sortCompsForDisplay(comps);
  const ebaySold: LiquidAskComp[] = [];
  const priceChartingSold: LiquidAskComp[] = [];
  const ebayActive: LiquidAskComp[] = [];
  const otherSold: LiquidAskComp[] = [];
  const otherActive: LiquidAskComp[] = [];
  const reference: LiquidAskComp[] = [];

  for (const c of sorted) {
    const src = (c.source ?? "").toLowerCase();
    const isPc = src.includes("pricecharting");
    const isEbay = src.includes("ebay") && !isPc;
    if (c.kind === "reference") {
      reference.push(c);
      continue;
    }
    if (c.kind === "sold") {
      if (isPc) priceChartingSold.push(c);
      else if (isEbay) ebaySold.push(c);
      else otherSold.push(c);
      continue;
    }
    if (isEbay) ebayActive.push(c);
    else otherActive.push(c);
  }

  return { ebaySold, priceChartingSold, ebayActive, otherSold, otherActive, reference };
}

export function countCompsBySource(comps: LiquidAskComp[]): {
  ebaySold: number;
  ebayActive: number;
  snippet: number;
} {
  let ebaySold = 0;
  let ebayActive = 0;
  let snippet = 0;
  for (const c of comps) {
    if ((c.source ?? "").toLowerCase().includes("ebay")) {
      if (c.kind === "sold") ebaySold++;
      else if (c.kind === "active") ebayActive++;
    } else {
      snippet++;
    }
  }
  return { ebaySold, ebayActive, snippet };
}
