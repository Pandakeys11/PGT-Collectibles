import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { getCardDisplayTitle } from "@/lib/scan/card-display";
import { formatMarketDate } from "@/lib/scan/market-intelligence";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

export function openAppraisalPrint(specimens: ScanSpecimen[], sessionTitle?: string): void {
  if (specimens.length === 0) return;
  const title = sessionTitle?.trim() || "PGT Liquid Scan Appraisal";
  const generated = new Date().toUTCString();
  const rows = specimens
    .map((item) => {
      const name = escapeHtml(getCardDisplayTitle(item.card));
      const setLine = escapeHtml(
        [item.card.set, item.card.number, item.card.year].filter(Boolean).join(" · ") || "—",
      );
      const fmv = item.context.fairValueUsd;
      const conf = item.context.catalogConfidence;
      const status = item.context.catalogIdentityStatus;
      const comps = (item.context.marketEvidence ?? [])
        .filter((c) => c.kind === "sold" && c.priceUsd != null)
        .slice(0, 4)
        .map(
          (c) =>
            `<tr><td>${escapeHtml(c.source ?? "—")}</td><td class="mono">${formatUsd(c.priceUsd)}</td><td>${escapeHtml(formatMarketDate(c.observedAt))}</td></tr>`,
        )
        .join("");
      const img = item.context.catalogImageUrl
        ? `<img src="${escapeHtml(item.context.catalogImageUrl)}" alt="" class="thumb" />`
        : item.previewUrl
          ? `<img src="${escapeHtml(item.previewUrl)}" alt="" class="thumb" />`
          : "";
      return `
        <section class="card-block">
          <div class="card-head">
            ${img}
            <div>
              <h2>${name}</h2>
              <p class="muted">${setLine}</p>
              <p><strong>FMV</strong> <span class="mono">${formatUsd(fmv)}</span>
                · <strong>Confidence</strong> ${conf != null ? `${Math.round(conf * 100)}%` : "—"}
                · <strong>Identity</strong> ${escapeHtml(status ?? "—")}</p>
            </div>
          </div>
          <table>
            <thead><tr><th>Source</th><th>Price</th><th>Date</th></tr></thead>
            <tbody>${comps || `<tr><td colspan="3">No sold comps in session</td></tr>`}</tbody>
          </table>
        </section>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #111; margin: 24px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .muted { color: #555; font-size: 13px; }
    .mono { font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; }
    .card-block { break-inside: avoid; margin: 20px 0; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
    .card-head { display: flex; gap: 16px; align-items: flex-start; }
    .thumb { width: 120px; height: auto; border-radius: 6px; object-fit: contain; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th, td { border-bottom: 1px solid #eee; padding: 6px 8px; text-align: left; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="muted">Generated ${escapeHtml(generated)} · PGT Vision</p>
  ${rows}
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
