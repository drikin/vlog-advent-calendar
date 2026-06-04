"use client";

import { useEffect, useState, useCallback } from "react";
import type { DayVideos, YouTubeVideo } from "@/lib/youtube";
import type { Channel } from "@/config/channels";

const WATCHED_KEY = "vlog-watched-videos";

function getChannelColor(channelId: string, channels: Channel[]): string {
  return channels.find((c) => c.id === channelId)?.color || "#666";
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return days[d.getDay()];
}

function VideoCard({
  video,
  watched,
  onWatch,
  channels,
}: {
  video: YouTubeVideo;
  watched: boolean;
  onWatch: (id: string) => void;
  channels: Channel[];
}) {
  const color = getChannelColor(video.channelId, channels);
  return (
    <a
      href={`https://youtube.com/watch?v=${video.videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onWatch(video.videoId)}
      className={`group block rounded-lg overflow-hidden border transition-all hover:shadow-lg hover:shadow-black/20 ${
        watched
          ? "bg-gray-900/80 border-green-800/50 opacity-70"
          : "bg-gray-800/50 border-gray-700/50 hover:border-gray-500/50"
      }`}
    >
      <div className="aspect-video bg-gray-700 relative overflow-hidden">
        <img
          src={video.thumbnail}
          alt={video.title}
          className={`w-full h-full object-cover transition-transform duration-300 ${
            watched ? "grayscale-[40%]" : "group-hover:scale-105"
          }`}
          loading="lazy"
        />
        {watched && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="bg-green-500/90 text-white text-xl rounded-full w-10 h-10 flex items-center justify-center shadow-lg">
              ✓
            </span>
          </div>
        )}
        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
          {formatTime(video.publishedAt)}
        </div>
      </div>
      <div className="p-2.5">
        <p
          className={`text-sm font-medium line-clamp-2 leading-snug mb-1.5 transition-colors ${
            watched ? "text-gray-400" : "text-gray-100 group-hover:text-white"
          }`}
        >
          {watched && <span className="text-green-400 mr-1">✓</span>}
          {video.title}
        </p>
        <p className="text-xs" style={{ color }}>
          {video.channelName}
        </p>
      </div>
    </a>
  );
}

function DayCell({
  date,
  videos,
  watched,
  onWatch,
  channels,
}: {
  date: string;
  videos: YouTubeVideo[];
  watched: Set<string>;
  onWatch: (id: string) => void;
  channels: Channel[];
}) {
  const day = parseInt(date.split("-")[2], 10);
  const dayOfWeek = getDayOfWeek(date);
  const isEmpty = videos.length === 0;
  const watchedCount = videos.filter((v) => watched.has(v.videoId)).length;
  const allWatched = videos.length > 0 && watchedCount === videos.length;

  if (isEmpty) {
    return (
      <div className="bg-gray-800/20 rounded-lg border border-gray-800/30 p-2 min-h-[160px] flex flex-col">
        <div className="text-center mb-2">
          <span className="text-sm font-bold text-gray-500">{day}</span>
          <span className="text-xs text-gray-600 ml-1">({dayOfWeek})</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-700 text-xs">—</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-2 min-h-[160px] transition-colors ${
        allWatched
          ? "bg-green-950/30 border-green-800/40"
          : "bg-gray-800/40 border-gray-700/30"
      }`}
    >
      <div className="text-center mb-2 flex items-center justify-center gap-1">
        <span className={`text-sm font-bold ${allWatched ? "text-green-400" : "text-gray-300"}`}>
          {day}
        </span>
        <span className="text-xs text-gray-500">({dayOfWeek})</span>
        {videos.length > 0 && (
          <span className="text-xs text-gray-600 ml-1">
            {watchedCount}/{videos.length}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {videos.map((v) => (
          <VideoCard
            key={v.videoId}
            video={v}
            watched={watched.has(v.videoId)}
            onWatch={onWatch}
            channels={channels}
          />
        ))}
      </div>
    </div>
  );
}

export default function VlogCalendarClient({
  days,
  error,
  channels,
  updatedAt,
}: {
  days: DayVideos[];
  error: string | null;
  channels: Channel[];
  updatedAt: string;
}) {
  const [watched, setWatched] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(WATCHED_KEY);
      if (saved) setWatched(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  const handleWatch = useCallback((videoId: string) => {
    setWatched((prev) => {
      const next = new Set(prev);
      next.add(videoId);
      try {
        localStorage.setItem(WATCHED_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">⚠️ データの取得に失敗しました</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  // Build a map of date->videos for all June dates
  const videoMap = new Map(days.map((d) => [d.date, d.videos]));
  const daysInJune = 30;
  const juneDates = Array.from({ length: daysInJune }, (_, i) => {
    const day = i + 1;
    const dateStr = `2026-06-${String(day).padStart(2, "0")}`;
    return { date: dateStr, videos: videoMap.get(dateStr) || [] };
  });

  const totalVideos = days.reduce((s, d) => s + d.videos.length, 0);
  const watchedCount = days.reduce(
    (s, d) => s + d.videos.filter((v) => watched.has(v.videoId)).length,
    0
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-center">
            📹 BSM地獄のVLOG強化月間
            <span className="text-gray-400 font-normal ml-2">2026.06</span>
          </h1>
          <p className="text-center text-gray-400 mt-2 text-sm">
            参加メンバーの毎日のVLOGをチェック！脱落したらドリキン賞です(爆)
          </p>
          <p className="text-center text-gray-500 mt-1 text-xs">
            参加希望メンバーはドリキンに連絡ください
          </p>
          {totalVideos > 0 && (
            <div className="max-w-sm mx-auto mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>視聴済み</span>
                <span className="text-green-400 font-medium">{watchedCount} / {totalVideos}</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${(watchedCount / totalVideos) * 100}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {channels.map((ch) => (
              <a
                key={ch.id}
                href={`https://youtube.com/${ch.handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2.5 py-1 rounded-full border border-gray-700 hover:border-gray-500 transition-colors"
                style={{ borderColor: ch.color + "40", color: ch.color }}
              >
                {ch.name}
              </a>
            ))}
          </div>
          <p className="text-center text-gray-600 text-xs mt-3">
            Last updated: {new Date(updatedAt).toLocaleString("ja-JP")}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="hidden md:grid md:grid-cols-5 lg:grid-cols-7 gap-3">
          {juneDates.map(({ date, videos }) => (
            <DayCell key={date} date={date} videos={videos} watched={watched} onWatch={handleWatch} channels={channels} />
          ))}
        </div>

        <div className="md:hidden space-y-4">
          {juneDates
            .filter((d) => d.videos.length > 0)
            .concat(juneDates.filter((d) => d.videos.length === 0))
            .map(({ date, videos }) => (
              <DayCell key={date} date={date} videos={videos} watched={watched} onWatch={handleWatch} channels={channels} />
            ))}
        </div>
      </main>

      <footer className="border-t border-gray-800 py-4 text-center text-gray-600 text-xs">
        Made with ❤️ for BSM地獄のVLOG強化月間 2026.06
      </footer>
    </div>
  );
}
