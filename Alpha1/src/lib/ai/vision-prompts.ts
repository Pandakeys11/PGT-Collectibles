import { buildVisionSetIdentificationBlock } from "@/lib/scan/set-identification";

const CARD_FIELDS = `"encapsulation":"raw|graded_slab","name":"","printedName":"","language":"","set":"","number":"","year":"","rarity":"","printStamps":"","details":"","grader":null,"grade":null,"cert":null,"extractedPrice":null,"stickerNote":null,"location":[y,x]`;

const CARD_FIELDS_WITH_BBOX = `${CARD_FIELDS},"bbox":{"top":0,"left":0,"width":0,"height":0}`;

const SHARED_RULES = `
- Never invent cert numbers on raw cards.
- Multilingual cards: set **language** to the visible print language when known (English, Japanese, German, French, Italian, Spanish, Portuguese, Korean, Chinese, Dutch, Polish, Russian, Thai, Indonesian, etc.).
- **name** should be the English Pokemon TCG catalog name when you can confidently map it. **printedName** is the exact visible title on the card, especially for non-English cards. If you cannot translate/map the title, put the visible title in both name and printedName and explain language uncertainty in details.
- Do not put language in number; use language plus printedName/details.
${buildVisionSetIdentificationBlock()}`;

export function buildVisionPrompt(options: { singleCardCrop: boolean; compact: boolean }): string {
  const fields = options.compact ? CARD_FIELDS : CARD_FIELDS_WITH_BBOX;
  const detailsRule = options.compact
    ? "- Keep **details** under 40 characters per card."
    : "- Keep **details** under 120 characters per card so the full JSON fits in one response.";
  const bboxRule = options.compact
    ? "- Omit bbox; location [y,x] on 0-1000 is enough."
    : "- bbox is the visible card/slab rectangle on 0-1000: top, left, width, height when edges are visible.";

  if (options.singleCardCrop) {
    return `You are a Pokémon / TCG vision extractor. This image is a **tight crop of ONE card or slab**.

Return JSON only:
{"cards":[{${fields}}]}

Rules:
- Return **exactly one** card object.
- location ~[500,500] when centered.
${bboxRule}
${detailsRule}
- graded_slab when PSA/CGC/BGS/SGC visible: read **grader** (PSA/CGC/BGS/SGC), **grade** on the label (10, 9.5, GEM MINT, etc.), and **cert** as digits only (no #). Put sticker/tag price in **extractedPrice** and short note in **stickerNote** when visible.
- Raw cards: cert/grader/grade null.
${SHARED_RULES}`;
  }

  return `You are a Pokémon / TCG vision extractor. The image may show a binder page, raw cards, graded slabs, or a mixed grid.

Return JSON only:
{"cards":[{${fields}}]}

Rules:
- One entry per visible trading card (row-major: left→right, top→bottom).
- graded_slab when a professional slab is visible: read **grader**, **grade** on the label, and **cert** (digits). Sticker/tag ask → **extractedPrice** + **stickerNote**.
- Raw cards: cert/grader/grade null.
- location: card center on 0-1000 (y down, x right).
${bboxRule}
${detailsRule}
${SHARED_RULES}`;
}
