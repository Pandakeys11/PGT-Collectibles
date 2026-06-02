"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { loadYoutubeIframeApi } from "@/lib/music/youtube-iframe-api";

export type YoutubePlayerConfig = {
  videoId: string;
  playlistId?: string;
};

export function useYoutubePlayer(
  mountRef: RefObject<HTMLDivElement | null>,
  config: YoutubePlayerConfig,
) {
  const playerRef = useRef<YT.Player | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const syncTitle = useCallback(() => {
    try {
      const data = playerRef.current?.getVideoData();
      if (data?.title) setVideoTitle(data.title);
    } catch {
      /* player not ready */
    }
  }, []);

  const syncPlayerSize = useCallback(() => {
    const el = mountRef.current;
    const player = playerRef.current;
    if (!el || !player) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (width > 0 && height > 0) {
      try {
        player.setSize(width, height);
      } catch {
        /* player tearing down */
      }
    }
  }, [mountRef]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setPlaying(false);
    setError(null);

    void loadYoutubeIframeApi()
      .then((YT) => {
        if (cancelled || !mountRef.current) return;

        playerRef.current?.destroy();
        playerRef.current = null;

        const playerVars: Record<string, string | number> = {
          autoplay: 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          fs: 1,
          origin: typeof window !== "undefined" ? window.location.origin : "",
        };

        if (config.playlistId) {
          playerVars.list = config.playlistId;
          playerVars.listType = "playlist";
        }

        playerRef.current = new YT.Player(mountRef.current, {
          width: "100%",
          height: "100%",
          videoId: config.videoId,
          playerVars,
          events: {
            onReady: () => {
              if (cancelled) return;
              setReady(true);
              syncTitle();
              syncPlayerSize();
            },
            onStateChange: (event) => {
              if (cancelled) return;
              setPlaying(event.data === YT.PlayerState.PLAYING);
              if (
                event.data === YT.PlayerState.PLAYING ||
                event.data === YT.PlayerState.PAUSED ||
                event.data === YT.PlayerState.ENDED
              ) {
                syncTitle();
              }
            },
            onError: () => {
              if (cancelled) return;
              setError("This video could not be loaded.");
            },
          },
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "YouTube player failed to load");
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [config.playlistId, config.videoId, mountRef, syncPlayerSize, syncTitle]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncPlayerSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [mountRef, ready, syncPlayerSize]);

  const play = useCallback(() => {
    playerRef.current?.playVideo();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
  }, []);

  const toggle = useCallback(() => {
    const state = playerRef.current?.getPlayerState();
    if (state === YT.PlayerState.PLAYING) pause();
    else play();
  }, [pause, play]);

  const next = useCallback(() => {
    playerRef.current?.nextVideo();
    window.setTimeout(syncTitle, 400);
  }, [syncTitle]);

  const prev = useCallback(() => {
    playerRef.current?.previousVideo();
    window.setTimeout(syncTitle, 400);
  }, [syncTitle]);

  return {
    ready,
    playing,
    videoTitle,
    error,
    play,
    pause,
    toggle,
    next,
    prev,
  };
}
