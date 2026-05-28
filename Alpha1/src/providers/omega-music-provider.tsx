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
  OMEGA_MUSIC_INITIAL_STATE,
  OMEGA_MUSIC_PLAYER_CONFIGS,
  OMEGA_MUSIC_TRACKS,
  type OmegaMusicTrack,
} from "@/lib/music/omega-tracks";

export type OmegaMusicContextValue = {
  tracks: OmegaMusicTrack[];
  playerStates: Record<string, boolean>;
  activeTrackIndex: number;
  currentTrack: OmegaMusicTrack;
  isAnyPlaying: boolean;
  toggleCurrentTrack: () => void;
  handleOmegaPlayerClick: (playerType: string) => void;
  handleNextTrack: () => void;
  handlePrevTrack: () => void;
  setActiveTrackIndex: (index: number) => void;
};

const OmegaMusicContext = createContext<OmegaMusicContextValue | undefined>(undefined);

function buildIframeSrc(config: { videoId: string; playlist?: string }): string {
  const playlistParam = config.playlist ? `&list=${config.playlist}` : "";
  return `https://www.youtube.com/embed/${config.videoId}?autoplay=1&controls=0&showinfo=0&rel=0&modestbranding=1&enablejsapi=1&iv_load_policy=3&fs=0&cc_load_policy=0&playsinline=1${playlistParam}`;
}

export function OmegaMusicProvider({ children }: { children: ReactNode }) {
  const [playerStates, setPlayerStates] = useState<Record<string, boolean>>(() => ({
    ...OMEGA_MUSIC_INITIAL_STATE,
  }));
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});

  const isAnyPlaying = Object.values(playerStates).some(Boolean);
  const currentTrack = OMEGA_MUSIC_TRACKS[activeTrackIndex] ?? OMEGA_MUSIC_TRACKS[0]!;

  const createPlayerIframe = useCallback((playerType: string) => {
    const config = OMEGA_MUSIC_PLAYER_CONFIGS[playerType];
    if (!config || typeof document === "undefined") return null;

    const iframeId = `pgt-omega-music-${playerType}-iframe`;
    let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;

    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = iframeId;
      iframe.src = buildIframeSrc(config);
      iframe.style.cssText =
        "position:absolute;width:0;height:0;border:none;opacity:0;pointer-events:none;";
      iframe.allow = "autoplay; encrypted-media";
      iframe.setAttribute("allowfullscreen", "");
      document.body.appendChild(iframe);
      iframeRefs.current[playerType] = iframe;
    }
    return iframe;
  }, []);

  const controlIframe = useCallback(
    (playerType: string, action: "play" | "pause") => {
      let iframe = iframeRefs.current[playerType];

      if (action === "play" && !iframe) {
        createPlayerIframe(playerType);
        return;
      }

      if (iframe?.contentWindow) {
        try {
          const command = action === "play" ? "playVideo" : "pauseVideo";
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: command, args: "" }),
            "*",
          );
        } catch {
          /* ignore cross-origin postMessage failures */
        }
      }
    },
    [createPlayerIframe],
  );

  const handleOmegaPlayerClick = useCallback(
    (playerType: string) => {
      const isCurrentlyPlaying = playerStates[playerType];

      Object.keys(OMEGA_MUSIC_PLAYER_CONFIGS).forEach((type) => {
        if (type !== playerType && playerStates[type]) {
          controlIframe(type, "pause");
          setPlayerStates((prev) => ({ ...prev, [type]: false }));
        }
      });

      if (isCurrentlyPlaying) {
        controlIframe(playerType, "pause");
        setPlayerStates((prev) => ({ ...prev, [playerType]: false }));
      } else {
        controlIframe(playerType, "play");
        setPlayerStates((prev) => ({ ...prev, [playerType]: true }));
      }
    },
    [playerStates, controlIframe],
  );

  const toggleCurrentTrack = useCallback(() => {
    handleOmegaPlayerClick(currentTrack.id);
  }, [currentTrack.id, handleOmegaPlayerClick]);

  const switchTrack = useCallback(
    (nextIndex: number) => {
      const current = OMEGA_MUSIC_TRACKS[activeTrackIndex];
      const next = OMEGA_MUSIC_TRACKS[nextIndex];
      if (!current || !next) return;

      setActiveTrackIndex(nextIndex);

      if (isAnyPlaying) {
        controlIframe(current.id, "pause");
        setPlayerStates((prev) => ({ ...prev, [current.id]: false }));
        controlIframe(next.id, "play");
        setPlayerStates((prev) => ({ ...prev, [next.id]: true }));
      }
    },
    [activeTrackIndex, isAnyPlaying, controlIframe],
  );

  const handleNextTrack = useCallback(() => {
    switchTrack((activeTrackIndex + 1) % OMEGA_MUSIC_TRACKS.length);
  }, [activeTrackIndex, switchTrack]);

  const handlePrevTrack = useCallback(() => {
    switchTrack((activeTrackIndex - 1 + OMEGA_MUSIC_TRACKS.length) % OMEGA_MUSIC_TRACKS.length);
  }, [activeTrackIndex, switchTrack]);

  useEffect(() => {
    return () => {
      Object.keys(OMEGA_MUSIC_PLAYER_CONFIGS).forEach((type) => {
        const iframe = iframeRefs.current[type];
        iframe?.parentNode?.removeChild(iframe);
      });
    };
  }, []);

  const value = useMemo(
    (): OmegaMusicContextValue => ({
      tracks: OMEGA_MUSIC_TRACKS,
      playerStates,
      activeTrackIndex,
      currentTrack,
      isAnyPlaying,
      toggleCurrentTrack,
      handleOmegaPlayerClick,
      handleNextTrack,
      handlePrevTrack,
      setActiveTrackIndex,
    }),
    [
      playerStates,
      activeTrackIndex,
      currentTrack,
      isAnyPlaying,
      toggleCurrentTrack,
      handleOmegaPlayerClick,
      handleNextTrack,
      handlePrevTrack,
    ],
  );

  return <OmegaMusicContext.Provider value={value}>{children}</OmegaMusicContext.Provider>;
}

export function useOmegaMusic(): OmegaMusicContextValue {
  const ctx = useContext(OmegaMusicContext);
  if (!ctx) throw new Error("useOmegaMusic must be used within OmegaMusicProvider");
  return ctx;
}
