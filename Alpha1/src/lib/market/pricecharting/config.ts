/** PriceCharting completed-auction scrape (product page tables). */
export function isPriceChartingSoldScrapeEnabled(): boolean {
  const off = process.env.PGT_DISABLE_PRICECHARTING_SOLD?.trim().toLowerCase();
  if (off === "1" || off === "true") return false;
  const flag = process.env.PRICECHARTING_SOLD_SCRAPE?.trim().toLowerCase();
  if (flag === "0" || flag === "false") return false;
  return true;
}
