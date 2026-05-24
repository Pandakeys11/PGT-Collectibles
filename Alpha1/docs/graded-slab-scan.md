# Graded slab label extraction (PSA / CGC / BGS)

Liquid Scan treats the **top holder label** as the source of truth for graded cards.

## User-facing mode

Select **Graded Card Mode** in the composer — this sets `gradedFocus` on vision requests so the model prioritizes slab tag OCR over card artwork.

## Pipeline

1. **Vision** (`buildVisionPrompt` + `GRADED_SLAB_LABEL_RULES`) — copy full tag into `labelTitle` (up to 400 chars) and structured fields.
2. **Normalize** (`normalizeGradedSlabFields`) — merge label + grade lines, parse with `parseStructuredSlabLabel`, extract BGS/CGC sub-grades into `details`.
3. **Enrich** — catalog + cert registry + PSA 10 comps using parsed identity.

## Fields

| Field | Source |
|-------|--------|
| `labelTitle` | Verbatim holder tag (all lines, · separated) |
| `name`, `set`, `number`, `year` | Parsed from tag |
| `grader`, `grade` | Grade badge on label |
| `cert` | Only when printed on front; else `NA` |
| `details` | Sub-grades, GEM MT, cert-on-back note |

## Tips for testers

- Photograph slabs **straight-on** with the **label tag fully in frame** and readable.
- Glare on the red PSA / blue CGC label is the main failure mode.
- Cert on slab back: expect **Cert NA** until user enters cert or registry enrich runs.
