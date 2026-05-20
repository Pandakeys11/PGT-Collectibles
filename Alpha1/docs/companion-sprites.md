# Companion sprite pipeline (A → B → C)

## Option A — Showdown animated (fallback)

- **Source:** `https://play.pokemonshowdown.com/sprites/ani/{slug}.gif`
- **Code:** `src/lib/companion/sprites.ts`, `src/lib/companion/showdown-slugs.ts`
- **Verify:** `npm run sprites:verify` (79/80 roster; Miraidon missing on Showdown)

## Option B — Supabase hosted CDN (recommended for production)

Uniform sharp GIFs + artwork from your project bucket. When enabled, the app tries hosted URLs first, then Showdown (A), then artwork battle portraits (C).

### Setup

1. Apply migration `supabase/migrations/202605200001_pokemon_sprite_assets.sql`  
   `npm run db:push` or run SQL in Supabase dashboard.

2. Upload roster assets:

```bash
npm run sprites:upload
```

Creates public bucket `pokemon-sprites`, uploads `ani/{id}.gif` and `artwork/{id}.png`, upserts `pokemon_sprite_assets`, writes `public/companion-sprite-manifest.json`.

3. Enable in `.env.local`:

```env
NEXT_PUBLIC_PGT_SPRITE_CDN=https://YOUR_PROJECT.supabase.co/storage/v1/object/public/pokemon-sprites
NEXT_PUBLIC_COMPANION_SPRITES_HOSTED=1
```

`NEXT_PUBLIC_PGT_SPRITE_CDN` is optional if `NEXT_PUBLIC_SUPABASE_URL` is set (CDN URL is derived automatically).

4. Restart dev server. Manifest loads via `SpriteManifestProvider` → `/api/companion/sprite-assets` (DB) or `/companion-sprite-manifest.json` (static).

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run sprites:verify` | Check Showdown availability for roster |
| `npm run sprites:sync` | Dry-run upload plan |
| `npm run sprites:upload` | Upload + DB + manifest |
| `node scripts/sync-companion-sprites-storage.mjs --manifest-only` | Regenerate JSON from DB only |

Does **not** break builds when Option B env vars are unset (Showdown + artwork only).

## Option C — Artwork battle portraits

- **Source:** Hosted artwork PNG → PokeAPI official art
- **UI:** `display="battle"` — animated chain, then `PokemonArtworkPresent` (float, type aura, holo)
- **Used for:** Species without Showdown ani (e.g. Miraidon) and battle arena polish

## Display modes (`PokemonSprite`)

| `display` | Behavior |
|-----------|----------|
| `animated` | Hosted ani → Showdown → artwork |
| `battle` | Same chain; artwork uses battle motion variant |
| `artwork` | Artwork presentation only |
