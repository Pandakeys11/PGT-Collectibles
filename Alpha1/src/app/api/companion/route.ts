import { NextResponse } from "next/server";
import { getCompanionPayload } from "@/lib/companion/service";

export async function GET() {
  try {
    const payload = await getCompanionPayload();
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[companion/GET]", err);
    return NextResponse.json(
      {
        state: {
          hatched: false,
          pokemonId: null,
          pokemonName: null,
          pokemonSlug: null,
          pokemonTier: null,
          pokemonEra: null,
          hatchedAt: null,
          level: 1,
          xp: 0,
          xpToNext: 40,
          hunger: 0,
          energy: 0,
          mood: 0,
          moodLabel: "—",
          actionCooldowns: {},
          tasks: [],
          lifetime: { feeds: 0, plays: 0, trains: 0, battles: 0, rests: 0, tasksClaimed: 0 },
          lastTickAt: new Date().toISOString(),
          storage: "local",
        },
        databaseConfigured: false,
        signedIn: false,
        error: err instanceof Error ? err.message : "Failed to load companion",
      },
      { status: 500 },
    );
  }
}
