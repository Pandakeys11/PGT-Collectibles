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
- **Graded slabs (PSA/CGC/BGS/BVG/SGC/ACE/TAG):** The **top holder label / tag** is authoritative — read it before card art.
  - **encapsulation** = graded_slab for every professional slab in frame.
  - **labelTitle** (critical): copy **all visible holder label text** top-to-bottom, joined with " · " (year, brand, set, card #, name, grade line). Up to ~400 characters. This is the primary matching key.
  - **name**, **set**, **number**, **year** must be parsed from the label tag into their JSON fields (not guessed from artwork).
  - **number**: full collector code as printed — fractions (4/102), promo codes (SM245, SWSH198, SVP045, OP01-001), not Pokédex # alone.
  - **set**: full English catalog set name (e.g. "Sun & Moon Promos", "Sword & Shield", "Team Rocket 1st Edition") — never shorten to "Promo" alone when the label names the set.
  - **grader** + **grade** from the grade badge on the label (large number / GEM MT / PRISTINE / Black Label).
  - **PSA** red label: lines are often YEAR · GAME/SET · # · NAME; grade in top-right; cert # only if printed on this face (often bottom — 8–10 digits).
  - **CGC** blue label: YEAR MANUFACTURER SET # NAME; sub-grades (Centering/Corners/Edges/Surface) → **details**; cert often on back → null + note.
  - **BGS/BVG** gold label: grade top-left; sub-grades in **details**; card line below; cert often on back.
  - **SGC/ACE/TAG**: read visible tag text; cert only when explicitly printed on front.
  - **cert** = certification digits **only** when legibly on the label in this photo. **null** if on back or unreadable. Never use card #, year, or set code as cert.
  - **printStamps** from label when printed (1st Edition, Reverse Holo, Prizm, /99 serial).
  - **details**: qualifiers (GEM MT, Black Label, Pristine), BGS/CGC sub-grades, "Cert on back — enter manually" when cert not visible.
  - Sticker/tag ask on slab → **extractedPrice** + **stickerNote**.
  - If label and art disagree, **trust the label** and note conflict in **details**.`;

const GRADED_SCAN_PREAMBLE = `
**GRADED CARD SCAN — label tag priority**
- Target: professionally graded slabs (PSA, CGC, BGS, SGC, ACE, TAG).
- For each slab, read the **printed tag at the top of the holder** (not the card illustration below).
- Extract every legible field from that tag into labelTitle and the structured fields.
- Skip raw loose cards unless no slabs are visible.`;

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

export function buildVisionPrompt(options: {
  singleCardCrop: boolean;
  compact: boolean;
  /** Graded Card Mode — emphasize slab tag OCR */
  gradedFocus?: boolean;
}): string {
  const gradedBlock = options.gradedFocus ? `${GRADED_SCAN_PREAMBLE}\n` : "";
  const fields = options.compact ? CARD_FIELDS : CARD_FIELDS_WITH_BBOX;
  const detailsRule = options.compact
    ? "- Keep **details** under 40 characters per card."
    : "- Keep **details** under 120 characters per card so the full JSON fits in one response.";
  const bboxRule = options.compact
    ? "- Omit bbox; location [y,x] on 0-1000 is enough."
    : "- bbox is the visible card/slab rectangle on 0-1000: top, left, width, height when edges are visible.";

  if (options.singleCardCrop) {
    return `${gradedBlock}You are a multi-franchise trading-card vision extractor (TCG + sports). This image is a **tight crop of ONE card or slab**.

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

  return `${gradedBlock}You are a multi-franchise trading-card vision extractor (TCG + sports). The image may show a binder page, raw cards, graded slabs, or a mixed grid from **different games or sports**.

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
