import { z } from "zod";

export const companionActionIdSchema = z.enum(["feed", "play", "train", "battle", "rest"]);

export const companionStateSchema = z.object({
  hatched: z.boolean(),
  pokemonId: z.number().nullable(),
  pokemonName: z.string().nullable(),
  pokemonSlug: z.string().nullable(),
  pokemonTier: z.string().nullable(),
  pokemonEra: z.string().nullable(),
  hatchedAt: z.string().nullable(),
  level: z.number(),
  xp: z.number(),
  xpToNext: z.number(),
  hunger: z.number(),
  energy: z.number(),
  mood: z.number(),
  moodLabel: z.string(),
  actionCooldowns: z.record(z.string(), z.string().nullable()),
  tasks: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      window: z.enum(["daily", "weekly", "usage"]),
      progress: z.number(),
      goal: z.number(),
      rewardXp: z.number(),
      claimed: z.boolean(),
      complete: z.boolean(),
      resetsAt: z.string(),
    }),
  ),
  lifetime: z.object({
    feeds: z.number(),
    plays: z.number(),
    trains: z.number(),
    battles: z.number(),
    rests: z.number(),
    tasksClaimed: z.number(),
  }),
  lastTickAt: z.string(),
  storage: z.enum(["database", "local"]),
  starterRerollsUsed: z.number(),
  starterRerollsRemaining: z.number(),
});

export const companionQuestEventSchema = z.enum([
  "scan_session",
  "market_intelligence",
  "catalog_confirm",
  "cards_scanned",
]);

export type CompanionActionId = z.infer<typeof companionActionIdSchema>;
export type CompanionState = z.infer<typeof companionStateSchema>;

export const hatchBodySchema = z.object({
  gridSeed: z.number().int().optional(),
});

export const actionBodySchema = z.object({
  action: companionActionIdSchema,
  /** Client snapshot when DB row is missing (local hatch / migration pending). */
  companion: z.record(z.string(), z.unknown()).optional(),
});

export const claimTaskBodySchema = z.object({
  taskId: z.string().min(1).max(64),
  companion: z.record(z.string(), z.unknown()).optional(),
});

export const rerollStarterBodySchema = z.object({
  companion: z.record(z.string(), z.unknown()).optional(),
});

export const questEventBodySchema = z.object({
  event: companionQuestEventSchema,
  amount: z.number().int().min(1).max(50).optional(),
  companion: z.record(z.string(), z.unknown()).optional(),
});

export type CompanionQuestEvent = z.infer<typeof companionQuestEventSchema>;
