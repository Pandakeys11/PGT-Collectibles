import type { SupabaseClient } from "@supabase/supabase-js";
import type { DigitalScanSidecar } from "@/lib/digital-scan/types";

export const SCAN_VAULT_BUCKET = "scan-vault";

export type DigitalScanUploadInput = {
  specimenKey: string;
  filename: string;
  mime: string;
  width: number;
  height: number;
  cardIndexOnPage: number;
  lane: "raw" | "graded";
  catalogId: string | null;
  sidecar: DigitalScanSidecar;
  /** Raw base64 without data URL prefix */
  imageBase64: string;
  extractedCardId?: string | null;
};

function decodeBase64Image(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

export async function persistDigitalScanAssets(
  supabase: SupabaseClient,
  args: {
    userId: string;
    sessionId: string;
    uploads: DigitalScanUploadInput[];
  },
): Promise<{ savedCount: number; paths: string[] }> {
  const paths: string[] = [];
  let savedCount = 0;

  for (const upload of args.uploads) {
    const storagePath = `${args.userId}/${args.sessionId}/${upload.filename}`;
    const bytes = decodeBase64Image(upload.imageBase64);

    const { error: uploadError } = await supabase.storage
      .from(SCAN_VAULT_BUCKET)
      .upload(storagePath, bytes, {
        contentType: upload.mime,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed for ${upload.filename}: ${uploadError.message}`);
    }

    const row = {
      user_id: args.userId,
      session_id: args.sessionId,
      extracted_card_id: upload.extractedCardId ?? null,
      specimen_key: upload.specimenKey,
      storage_path: storagePath,
      filename: upload.filename,
      mime: upload.mime,
      width: upload.width,
      height: upload.height,
      card_index_on_page: upload.cardIndexOnPage,
      lane: upload.lane,
      catalog_id: upload.catalogId,
      sidecar_json: upload.sidecar,
      content_sha256: upload.sidecar.contentSha256,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("digital_scan_assets")
      .upsert(row, { onConflict: "session_id,specimen_key" });

    if (upsertError) {
      throw new Error(`DB save failed for ${upload.filename}: ${upsertError.message}`);
    }

    paths.push(storagePath);
    savedCount += 1;
  }

  return { savedCount, paths };
}

export async function listDigitalScanAssetsForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 200,
) {
  const { data, error } = await supabase
    .from("digital_scan_assets")
    .select(
      "id, session_id, specimen_key, storage_path, filename, mime, width, height, card_index_on_page, lane, catalog_id, sidecar_json, content_sha256, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listDigitalScanAssetsForSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from("digital_scan_assets")
    .select(
      "id, session_id, specimen_key, storage_path, filename, mime, width, height, card_index_on_page, lane, catalog_id, sidecar_json, content_sha256, created_at",
    )
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("card_index_on_page", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function publicScanVaultUrl(supabaseUrl: string, storagePath: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${SCAN_VAULT_BUCKET}/${storagePath}`;
}
