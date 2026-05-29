"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  PGT_MUSIC_PLAYER_CONFIGS,
  PGT_MUSIC_TRACKS,
  type PgtMusicTrack,
} from "@/lib/music/pgt-tracks";

export type PgtMusicContextValue = {
  tracks: PgtMusicTrack[];
  activeTrackIndex: number;
  currentTrack: PgtMusicTrack;
  isPlaying: boolean;
  togglePlay: () => void;
  playTrack: (trackId: string) => void;
  pauseAll: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
};

const PgtMusicContext = createContext<PgtMusicContextValue | undefined>(undefined);

function buildIframeSrc(config: { videoId: string; playlist?: string }, autoplay: boolean): string {
  const origin =
    typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";
  const playlistParam = config.playlist ? `&list=${config.playlist}` : "";
  return `https://www.youtube.com/embed/${config.videoId}?enablejsapi=1&origin=${origin}&autoplay=${autoplay ? 1 : 0}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&fs=0&cc_load_policy=0&playsinline=1${playlistParam}`;
}

function postPlayerCommand(iframe: HTMLIFrameElement, func: "playVideo" | "pauseVideo") {
  iframe.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: "" }), "*");
}

export function PgtMusicProvider({ children }: { children: ReactNode }) {
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});

  const currentTrack = PGT_MUSIC_TRACKS[activeTrackIndex] ?? PGT_MUSIC_TRACKS[0]!;
  const isPlaying = playingTrackId === currentTrack.id;

  const createIframe = useCallback((trackId: string, autoplay: boolean): HTMLIFrameElement | null => {
    const config = PGT_MUSIC_PLAYER_CONFIGS[trackId];
    if (!config || typeof document === "undefined") return null;

    const iframeId = `pgt-music-${trackId}`;
    let iframe = iframeRefs.current[trackId] ?? (document.getElementById(iframeId) as HTMLIFrameElement | null);

    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = iframeId;
      iframe.title = "PGT Player audio";
      iframe.src = buildIframeSrc(config, autoplay);
      iframe.style.cssText =
        "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px;top:-9999px;";
      iframe.allow = "autoplay; encrypted-media";
      iframe.setAttribute("allowfullscreen", "");
      document.body.appendChild(iframe);
      iframeRefs.current[trackId] = iframe;
    }

    return iframe;
  }, []);

  const pauseTrack = useCallback((trackId: string) => {
    const iframe = iframeRefs.current[trackId];
    if (iframe) postPlayerCommand(iframe, "pauseVideo");
    setPlayingTrackId((cur) => (cur === trackId ? null : cur));
  }, []);

  const pauseAll = useCallback(() => {
    Object.keys(PGT_MUSIC_PLAYER_CONFIGS).forEach((id) => {
      const iframe = iframeRefs.current[id];
      if (iframe) postPlayerCommand(iframe, "pauseVideo");
    });
    setPlayingTrackId(null);
  }, []);

  const playTrack = useCallback(
    (trackId: string) => {
      Object.keys(PGT_MUSIC_PLAYER_CONFIGS).forEach((id) => {
        if (id !== trackId) pauseTrack(id);
      });

      const existing = iframeRefs.current[trackId];
      if (!existing) {
        createIframe(trackId, true);
        setPlayingTrackId(trackId);
        return;
      }

      postPlayerCommand(existing, "playVideo");
      window.setTimeout(() => postPlayerCommand(existing, "playVideo"), 350);
      setPlayingTrackId(trackId);
    },
    [createIframe, pauseTrack],
  );

  const togglePlay = useCallback(() => {
    if (playingTrackId === currentTrack.id) {
      pauseTrack(currentTrack.id);
    } else {
      playTrack(currentTrack.id);
    }
  }, [playingTrackId, currentTrack.id, pauseTrack, playTrack]);

  const goToIndex = useCallback(
    (index: number) => {
      const next = PGT_MUSIC_TRACKS[index];
      if (!next) return;
      setActiveTrackIndex(index);
      if (playingTrackId) {
        pauseAll();
        playTrack(next.id);
      }
    },
    [playingTrackId, pauseAll, playTrack],
  );

  const nextTrack = useCallback(() => {
    goToIndex((activeTrackIndex + 1) % PGT_MUSIC_TRACKS.length);
  }, [activeTrackIndex, goToIndex]);

  const prevTrack = useCallback(() => {
    goToIndex((activeTrackIndex - 1 + PGT_MUSIC_TRACKS.length) % PGT_MUSIC_TRACKS.length);
  }, [activeTrackIndex, goToIndex]);

  useEffect(() => {
    return () => {
      Object.values(iframeRefs.current).forEach((iframe) => {
        iframe?.parentNode?.removeChild(iframe);
      });
      iframeRefs.current = {};
    };
  }, []);

  const value = useMemo(
    (): PgtMusicContextValue => ({
      tracks: PGT_MUSIC_TRACKS,
      activeTrackIndex,
      currentTrack,
      isPlaying,
      togglePlay,
      playTrack,
      pauseAll,
      nextTrack,
      prevTrack,
    }),
    [activeTrackIndex, currentTrack, isPlaying, togglePlay, playTrack, pauseAll, nextTrack, prevTrack],
  );

  return <PgtMusicContext.Provider value={value}>{children}</PgtMusicContext.Provider>;
}

export function usePgtMusic(): PgtMusicContextValue {
  const ctx = useContext(PgtMusicContext);
  if (!ctx) throw new Error("usePgtMusic must be used within PgtMusicProvider");
  return ctx;
}

/** @deprecated use usePgtMusic */
export const useOmegaMusic = usePgtMusic;
