export function buildDigitalScanHowToMarkdown(): string {
  return [
    "## Digital Scan — best results",
    "",
    "**Single raw card:** Place the card flat on a neutral background (white or light gray). Fill most of the frame. Avoid glare, shadows, and motion blur.",
    "",
    "**Single graded slab:** Shoot straight-on with the **full slab and label** visible. Keep the cert readable; avoid reflections on the case.",
    "",
    "**Binder page:** Lay the page **flat** with even lighting. All pockets should be visible. Digital Scan outputs **one file per card**, in order **left→right, top→bottom** — like a physical sheet feeder.",
    "",
    "**Graded slab page:** Same as binder — one digital scan **per slab**. Keep slabs separated and labels facing the camera.",
    "",
    "**Tips:** Higher-resolution photos produce sharper scans. After extract, use **Adjust crop** on any card before saving. Toggle Digital Scan off anytime to run identity + market only.",
  ].join("\n");
}
