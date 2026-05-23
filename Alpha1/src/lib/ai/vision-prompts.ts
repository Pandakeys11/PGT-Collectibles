import { buildVisionSetIdentificationBlock } from "@/lib/scan/set-identification";

const FRANCHISE_FIELD =
  '"franchise":"pokemon|onepiece|dragonball|sports|yugioh|magic|lorcana|other"';

const CARD_FIELDS = `${FRANCHISE_FIELD},"encapsulation":"raw|graded_slab","name":"","printedName":"","language":"","set":"","number":"","year":"","rarity":"","printStamps":"","labelTitle":"","details":"","grader":null,"grade":null,"cert":null,"extractedPrice":null,"stickerNote":null,"location":[y,x]`;

const CARD_FIELDS_WITH_BBOX = `${CARD_FIELDS},"bbox":{"top":0,"left":0,"width":0,"height":0}`;

const FRANCHISE_RULES = `
- **franchise** (required): classify from logos, copyright, layout, and set branding.
  - pokemon — Pokemon / Pocket Monsters TCG
  - onepiece — One Piece Card Game (OP-, ST-, EB- style numbers common)
  - dragonball — Dragon Ball Super / DBZ card game
  - yugioh — Yu-Gi-Oh! TCG
  - magic — Magic: The Gathering
  - lorcana — Disney Lorcana
  - sports — baseball, basketball, football, soccer, hockey, UFC, F1, WWE, etc. (Topps, Panini, Upper Deck, Donruss, Bowman)
  - other — identifiable trading card not matching above
- Never default franchise to pokemon unless Pokemon branding is visible.`;

const NAME_RULES = `
- Multilingual cards: set **language** when known (English, Japanese, German, French, Italian, Spanish, Portuguese, Korean, Chinese, etc.).
- **Pokemon only**: **name** = English Pokemon TCG catalog name when mappable; **printedName** = exact visible title (especially non-English).
- **Other TCG / sports**: **name** and **printedName** = best visible title on the card; preserve player names, set names, parallel names (Prizm, Optic, Select, rookie, auto, patch).
- Do not put language in number; use language plus printedName/details.`;

const POKEMON_SET_RULES = buildVisionSetIdentificationBlock();

const GRADED_SLAB_LABEL_RULES = `
- **Graded slabs (PSA/CGC/BGS/SGC/ACE):** The **holder label is authoritative** for identity — read it before guessing from card art.
  - Copy **name**, **set** (English catalog set name), **number** (full promo code e.g. SM245, SWSH198, SVP045), and **year** from the label text.
  - PSA labels often show YEAR · SET · CARD# · NAME on separate lines — merge into the JSON fields above.
  - Do not shorten set to "Promo" alone when the label names the promo set (e.g. "Sun & Moon Promos", "Sword & Shield Promos").
  - **encapsulation** = graded_slab; **grader**, **grade** from the front label.
  - **cert** = certification number **only if those digits are legibly visible in this image** (front label or barcode on the face shown). **null** if:
    - Cert # is on the **back** of the slab (common for CGC, TAG, many BGS/SGC) and not readable here
    - You would have to guess from card collector number, set code, or year
  - Never copy card number (e.g. 25/102, SM245), Pokédex digits, or set totals into **cert**.
  - **labelTitle** = copy the full primary slab label line verbatim (year · set · number · name as printed on the holder).
  - Include visible qualifiers in **grade** or **details** (GEM MT, Black Label, Pristine, Qualifier, sub-grades).
  - If cert is not visible, add to **details**: "Cert on back — enter manually".
  - Card art may be obscured — if label and art disagree, trust the label and note in details.`;

const PRINT_EDITION_RULES = `
- **printStamps** (required when visible): Capture **edition, finish, parallel, and language print** — never put these in **set** or **number**.
  - **Pokémon raw**: 1st Edition, Shadowless, Unlimited, Reverse Holo, Holo, Cosmos Holo, promo stamps (exact visible text).
  - **Sports**: Prizm, Silver Prizm, Refractor, Optic, Mosaic, rookie, auto, patch, serial (/99, /25), etc. as printed on the card.
  - **Other TCG** (Yu-Gi-Oh, Magic, One Piece, Lorcana): foil type, alt art, full art, secret rare, borderless, first edition, language print.
  - **Graded slabs**: copy edition/parallel from the **label** when printed (e.g. "1st Edition", "Reverse Holo", "Prizm"); if not on the label, leave printStamps empty — do not guess from art alone.
  - Combine multiple visible marks with " · " (e.g. \`1st Edition · Holo\`, \`Silver Prizm · /99\`).
  - If uncertain, set your best read in printStamps and note doubt in **details**.`;

const POKEMON_PRINT_EDITION_RULES = `
- Pokémon raw examples for printStamps:
  - **1st Edition** — circular logo bottom-left of art (Wizards era).
  - **Shadowless** — Base Set era without 1st stamp.
  - **Unlimited** — no 1st stamp, later print run.
  - **Reverse Holo** / **Holo** / promo marks as visible.`;

const SHARED_RULES = `
- Never invent cert numbers on raw cards.
${FRANCHISE_RULES}
${NAME_RULES}
- Apply Pokemon set/year/number rules below **only when franchise is pokemon**:
${POKEMON_SET_RULES}
- Apply graded slab label rules when encapsulation is graded_slab:
${GRADED_SLAB_LABEL_RULES}
- Apply print edition rules for every card (raw and graded when label shows edition):
${PRINT_EDITION_RULES}
- Pokémon raw stamp examples:
${POKEMON_PRINT_EDITION_RULES}`;

export function buildVisionPrompt(options: { singleCardCrop: boolean; compact: boolean }): string {
  const fields = options.compact ? CARD_FIELDS : CARD_FIELDS_WITH_BBOX;
  const detailsRule = options.compact
    ? "- Keep **details** under 40 characters per card."
    : "- Keep **details** under 120 characters per card so the full JSON fits in one response.";
  const bboxRule = options.compact
    ? "- Omit bbox; location [y,x] on 0-1000 is enough."
    : "- bbox is the visible card/slab rectangle on 0-1000: top, left, width, height when edges are visible.";

  if (options.singleCardCrop) {
    return `You are a multi-franchise trading-card vision extractor (TCG + sports). This image is a **tight crop of ONE card or slab**.

Return JSON only:
{"cards":[{${fields}}]}

Rules:
- Return **exactly one** card object.
- location ~[500,500] when centered.
${bboxRule}
${detailsRule}
- graded_slab when PSA/CGC/BGS/SGC/ACE/TAG visible: read **labelTitle**, **name**, **set**, **number**, **year**, **grader**, **grade** from the label; **cert** only if cert digits are clearly visible in this photo (else null). Sticker/tag price → **extractedPrice** + **stickerNote** when visible.
- Raw cards: cert/grader/grade null.
${SHARED_RULES}`;
  }

  return `You are a multi-franchise trading-card vision extractor (TCG + sports). The image may show a binder page, raw cards, graded slabs, or a mixed grid from **different games or sports**.

Return JSON only:
{"cards":[{${fields}}]}

Rules:
- One entry per visible trading card (row-major: left→right, top→bottom).
- Classify **franchise per card** — a single photo may include Pokemon beside sports or other TCGs.
- graded_slab when a professional slab is visible: read **labelTitle**, **name**, **set**, **number**, **year**, **grader**, **grade** from the label; **cert** only when certification digits are readable in-frame (else null). Sticker/tag ask → **extractedPrice** + **stickerNote**.
- Raw cards: cert/grader/grade null.
- location: card center on 0-1000 (y down, x right).
${bboxRule}
${detailsRule}
${SHARED_RULES}`;
}
