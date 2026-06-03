import {
  artMatchDimensions,
  artMatchModelId,
} from "@/lib/catalog/art-embedding";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export type StoredArtEmbedding = {
  franchise: string;
  catalogId: string;
  embedding: number[];
  imageUrl: string | null;
};

export async function loadArtEmbeddings(args: {
  franchise: string;
  catalogIds: string[];
}): Promise<Map<string, StoredArtEmbedding>> {
  const out = new Map<string, StoredArtEmbedding>();
  if (!isSupabaseConfigured() || args.catalogIds.length === 0) return out;

  const model = artMatchModelId();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tcg_catalog_art_embeddings")
    .select("franchise,catalog_id,embedding,image_url")
    .eq("franchise", args.franchise)
    .eq("model", model)
    .in("catalog_id", args.catalogIds);

  if (error || !data) return out;

  for (const row of data) {
    const embedding = row.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) continue;
    const values = embedding.filter((v): v is number => typeof v === "number");
    if (values.length !== embedding.length) continue;
    out.set(row.catalog_id, {
      franchise: row.franchise,
      catalogId: row.catalog_id,
      embedding: values,
      imageUrl: row.image_url ?? null,
    });
  }

  return out;
}

export async function upsertArtEmbedding(args: {
  franchise: string;
  catalogId: string;
  embedding: number[];
  imageUrl?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured() || args.embedding.length === 0) return;

  const supabase = getSupabaseAdmin();
  await supabase.from("tcg_catalog_art_embeddings").upsert(
    {
      franchise: args.franchise,
      catalog_id: args.catalogId,
      model: artMatchModelId(),
      dimensions: artMatchDimensions(),
      embedding: args.embedding,
      image_url: args.imageUrl ?? null,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "franchise,catalog_id,model" },
  );
}
