"use client";

import { useEffect, useRef } from "react";

interface YouTubePlayerProps {
  videoId: string;
  onEnd?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  autoplay?: boolean;
  className?: string;
}

let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise((resolve) => {
    if ((window as any).YT?.Player) {
      resolve();
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode?.insertBefore(tag, firstScript);
    (window as any).onYouTubeIframeAPIReady = () => resolve();
  });
  return apiLoadPromise;
}

export default function YouTubePlayer({
  videoId,
  onEnd,
  onPlay,
  onPause,
  autoplay = true,
  className,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef({ onEnd, onPlay, onPause });
  eventsRef.current = { onEnd, onPlay, onPause };

  useEffect(() => {
    let destroyed = false;
    let player: any;

    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return;
      const YT = (window as any).YT;
      player = new YT.Player(containerRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          modestbranding: 1,
          rel: 0,
          fs: 1,
          playsinline: 1,
        },
        events: {
          onStateChange: (e: any) => {
            if (e.data === 0) eventsRef.current.onEnd?.();
            if (e.data === 1) eventsRef.current.onPlay?.();
            if (e.data === 2) eventsRef.current.onPause?.();
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (player?.destroy) player.destroy();
    };
  }, [videoId, autoplay]);

  return <div ref={containerRef} className={className} />;
}
