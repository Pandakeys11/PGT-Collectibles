export type SpriteAssetManifestEntry = {
  nationalId: number;
  slug: string;
  name: string;
  hasAni: boolean;
  hasArtwork: boolean;
  aniUrl: string | null;
  artworkUrl: string | null;
};

export type SpriteAssetManifest = {
  version: number;
  updatedAt: string;
  cdnBase: string;
  entries: SpriteAssetManifestEntry[];
};
