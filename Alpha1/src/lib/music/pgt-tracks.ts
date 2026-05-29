export type PgtMusicTrack = {
  id: string;
  label: string;
  sublabel: string;
};

export type PgtMusicPlayerConfig = {
  videoId: string;
  playlist?: string;
};

export const PGT_MUSIC_TRACKS: PgtMusicTrack[] = [
  { id: "track1", label: "Blues", sublabel: "PGT Original" },
  { id: "track2", label: "Ambient", sublabel: "PGT Original" },
  { id: "track3", label: "Lo-Fi Girl", sublabel: "Live stream" },
  { id: "track4", label: "Synthwave", sublabel: "Playlist" },
  { id: "track5", label: "Lo-Fi Beats", sublabel: "PGT Original" },
  { id: "track6", label: "Tech House", sublabel: "PGT Original" },
  { id: "track7", label: "Funky", sublabel: "PGT Original" },
  { id: "track8", label: "Trance", sublabel: "Playlist" },
  { id: "track9", label: "Melodies", sublabel: "PGT Original" },
];

export const PGT_MUSIC_PLAYER_CONFIGS: Record<string, PgtMusicPlayerConfig> = {
  track1: { videoId: "sF80I-TQiW0" },
  track2: { videoId: "KVq0PCi81v4" },
  track3: { videoId: "jfKfPfyJRdk" },
  track4: { videoId: "qiH74Z5-dO0", playlist: "RDqiH74Z5-dO0" },
  track5: { videoId: "4xDzrJKXOOY" },
  track6: { videoId: "-WEWVsC8CyA" },
  track7: { videoId: "7XPGU7dmZXg" },
  track8: { videoId: "T2QZpy07j4s", playlist: "RDT2QZpy07j4s" },
  track9: { videoId: "nxqlTRYs6NY" },
};

export const PGT_MUSIC_INITIAL_STATE: Record<string, boolean> = Object.fromEntries(
  PGT_MUSIC_TRACKS.map((t) => [t.id, false]),
);

/** @deprecated */
export const OMEGA_MUSIC_TRACKS = PGT_MUSIC_TRACKS;
export const OMEGA_MUSIC_PLAYER_CONFIGS = PGT_MUSIC_PLAYER_CONFIGS;
export const OMEGA_MUSIC_INITIAL_STATE = PGT_MUSIC_INITIAL_STATE;
