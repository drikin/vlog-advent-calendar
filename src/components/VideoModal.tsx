"use client";

import { useEffect, useCallback } from "react";
import YouTubePlayer from "./YouTubePlayer";

interface VideoModalProps {
  videoId: string;
  title: string;
  channelName: string;
  channelColor: string;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onEnded?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  autoPlayNext: boolean;
  onToggleAutoPlay: () => void;
  watchedCount: number;
  totalInPlaylist: number;
}

export default function VideoModal({
  videoId,
  title,
  channelName,
  channelColor,
  onClose,
  onNext,
  onPrev,
  onEnded,
  hasNext,
  hasPrev,
  autoPlayNext,
  onToggleAutoPlay,
  watchedCount,
  totalInPlaylist,
}: VideoModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "j") onNext?.();
      if (e.key === "ArrowLeft" || e.key === "k") onPrev?.();
    },
    [onClose, onNext, onPrev]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl mx-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="min-w-0 flex-1 mr-4">
            <h3 className="text-white text-sm font-medium truncate">{title}</h3>
            <p className="text-xs truncate" style={{ color: channelColor }}>{channelName}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasPrev && (
              <button onClick={(e) => { e.stopPropagation(); onPrev?.(); }} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg" title="前 (K)">‹</button>
            )}
            {hasNext && (
              <button onClick={(e) => { e.stopPropagation(); onNext?.(); }} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg" title="次 (J)">›</button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleAutoPlay(); }}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                autoPlayNext ? "bg-green-900/40 text-green-400 border-green-700/50" : "bg-gray-800/50 text-gray-400 border-gray-700/50"
              }`}
              title={autoPlayNext ? "未読のみ連続再生中" : "連続再生OFF"}
            >
              {autoPlayNext ? "🔁 未読連続" : "⏹ 連続OFF"}
            </button>
            <span className="text-[10px] text-gray-500">{watchedCount}/{totalInPlaylist}</span>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors" title="閉じる (ESC)">✕</button>
          </div>
        </div>
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <YouTubePlayer videoId={videoId} onEnd={onEnded} autoplay={true} />
        </div>
        <div className="flex justify-center gap-4 mt-2 text-[10px] text-gray-500">
          <span>ESC 閉じる</span>
          <span>J / → 次</span>
          <span>K / ← 前</span>
        </div>
      </div>
    </div>
  );
}
