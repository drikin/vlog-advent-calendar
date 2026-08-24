"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { DayVideos, YouTubeVideo } from "@/lib/youtube";
import type { Channel } from "@/config/channels";
import { MONTHS, monthLabel, monthKey, daysInMonth, todayJstDate } from "@/lib/months";
import Tour from "./Tour";

const WATCHED_KEY = "vlog-watched-videos";

/** videoId → watchedAt (ISO string) */
type WatchedMap = Map<string, string>;

function loadWatchedLocal(): WatchedMap {
  try {
    const saved = localStorage.getItem(WATCHED_KEY);
    if (saved) return new Map(Object.entries(JSON.parse(saved)));
  } catch {}
  return new Map();
}

function saveWatchedLocal(watched: WatchedMap) {
  try {
    localStorage.setItem(WATCHED_KEY, JSON.stringify(Object.fromEntries(watched)));
  } catch {}
}

/* ─── Session prefs（UI 選択をセッション内で保持。リロードしてもリセットされない） ─── */

const PREFS_KEY = "vlog-calendar-prefs";

type VlogPrefs = {
  showUnwatchedOnly?: boolean;
  viewMode?: "calendar" | "ranking";
  activeChannelFilter?: string | null;
  activeMonth?: string;
  lastRankingTab?: RankingTab;
};

function loadPrefs(): VlogPrefs {
  try {
    const raw = sessionStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw) as VlogPrefs;
  } catch {}
  return {};
}

function savePrefs(p: VlogPrefs) {
  try {
    sessionStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}

async function loadWatchedApi(): Promise<WatchedMap | null> {
  try {
    const res = await fetch("/api/watched");
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.entries || !Array.isArray(data.entries)) return null;
    return new Map(data.entries.map((e: { videoId: string; watchedAt: string }) => [e.videoId, e.watchedAt]));
  } catch {
    return null;
  }
}

async function markWatchedApi(videoId: string): Promise<WatchedMap | null> {
  try {
    const res = await fetch("/api/watched", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.entries || !Array.isArray(data.entries)) return null;
    return new Map(data.entries.map((e: { videoId: string; watchedAt: string }) => [e.videoId, e.watchedAt]));
  } catch {
    return null;
  }
}

/**
 * Migrate localStorage watched data to the API.
 * Called once on login when API has no data for this user.
 */
async function migrateLocalToApi(): Promise<WatchedMap | null> {
  const local = loadWatchedLocal();
  if (local.size === 0) return local; // nothing to migrate

  try {
    const videoIds = Array.from(local.keys());
    const res = await fetch("/api/watched", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: videoIds.map((videoId) => ({ videoId })) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.entries || !Array.isArray(data.entries)) return null;
    return new Map(data.entries.map((e: { videoId: string; watchedAt: string }) => [e.videoId, e.watchedAt]));
  } catch {
    return null;
  }
}

/* ─── Helpers ─── */

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

/* ─── VideoCard ─── */

function VideoCard({
  video,
  watched,
  watchedAt,
  onWatch,
  channels,
}: {
  video: YouTubeVideo;
  watched: boolean;
  watchedAt: string | null;
  onWatch: (id: string) => void;
  channels: Channel[];
}) {
  const color = getChannelColor(video.channelId, channels);

  // Format watched date as "6/5" style stamp
  const stampLabel = watchedAt
    ? new Date(watchedAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
    : null;

  return (
    <a
      href={`https://youtube.com/watch?v=${video.videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onWatch(video.videoId)}
      className={`group block rounded-md overflow-hidden border transition-all hover:shadow-lg hover:shadow-black/20 ${
        watched
          ? "bg-gray-900/80 border-green-800/50 opacity-70"
          : "bg-gray-800/50 border-gray-700/50 hover:border-gray-500/50"
      }`}
    >
      <div className="aspect-video bg-gray-700 relative overflow-hidden">
        <img
          src={video.thumbnail}
          alt={video.title}
          className={`w-full h-full object-cover ${watched ? "grayscale opacity-80" : "group-hover:scale-105"} transition-transform duration-300`}
          loading="lazy"
        />
        {watched && stampLabel && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Stamp-style overlay */}
            <div className="relative">
              {/* Outer ring */}
              <div className="w-16 h-16 rounded-full border-2 border-green-400/70 flex items-center justify-center rotate-[-12deg] shadow-lg">
                {/* Inner circle */}
                <div className="text-center leading-tight">
                  <div className="text-green-300 text-xs font-bold tracking-wider">視聴済</div>
                  <div className="text-green-400 text-sm font-bold">{stampLabel}</div>
                </div>
              </div>
              {/* Decorative lines around stamp */}
              <div className="absolute -top-1 -left-1 w-18 h-18 rounded-full border border-green-400/20 rotate-12 pointer-events-none" />
            </div>
          </div>
        )}
        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
          {formatTime(video.publishedAt)}
        </div>
      </div>
      <div className="p-2">
        <p
          className={`text-xs font-medium line-clamp-2 leading-snug mb-0.5 min-h-[2rem] transition-colors ${
            watched ? "text-gray-400" : "text-gray-100 group-hover:text-white"
          }`}
        >
          {watched && <span className="text-green-400 mr-1">✓</span>}
          {video.title}
        </p>
        <p className="text-[10px]" style={{ color }}>
          {video.channelName}
        </p>
      </div>
    </a>
  );
}

/* ─── DayCell ─── */

function DayCell({
  date,
  videos,
  watched,
  onWatch,
  channels,
}: {
  date: string;
  videos: YouTubeVideo[];
  watched: WatchedMap;
  onWatch: (id: string) => void;
  channels: Channel[];
}) {
  const day = parseInt(date.split("-")[2], 10);
  const dayOfWeek = getDayOfWeek(date);
  const isWeekend = dayOfWeek === "土" || dayOfWeek === "日";
  const isEmpty = videos.length === 0;
  const watchedCount = videos.filter((v) => watched.has(v.videoId)).length;
  const unwatchedCount = videos.length - watchedCount;
  const allWatched = videos.length > 0 && watchedCount === videos.length;

  // Check if this cell is today (JST)
  const todayStr = todayJstDate();
  const isToday = date === todayStr;

  if (isEmpty) {
    return (
      <div className={`rounded-lg border p-2 min-h-[120px] flex flex-col theme-cell-border theme-cell-bg ${
        isToday ? "ring-2 ring-amber-400/60 ring-inset" : ""
      } ${
        isWeekend ? "bg-white/[0.03]" : ""
      }`}>
        <div className="text-center mb-1">
          <span className={`text-sm font-bold ${isToday ? "text-amber-300" : isWeekend ? "text-red-400/70" : "text-gray-500"}`}>
            {isToday ? "📌 " : ""}{day}
          </span>
          <span className={`text-xs ml-1 ${isWeekend ? "text-red-400/50" : "text-gray-600"}`}>({dayOfWeek})</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-700 text-xs">—</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-2 min-h-[120px] transition-colors theme-cell-border theme-cell-bg ${
        allWatched
          ? "border-green-800/40 bg-green-900/20"
          : ""
      } ${
        isToday ? "ring-2 ring-amber-400/60 ring-inset" : ""
      } ${
        isWeekend && !allWatched ? "bg-white/[0.03]" : ""
      }`}
    >
      <div className="text-center mb-1.5 flex items-center justify-center gap-1">
        <span className={`text-sm font-bold ${allWatched ? "text-green-400" : isToday ? "text-amber-300" : isWeekend ? "text-red-400/70" : "text-gray-300"}`}>
          {isToday ? "📌 " : ""}{day}
        </span>
        <span className={`text-xs ${isWeekend ? "text-red-400/50" : "text-gray-500"}`}>({dayOfWeek})</span>
        {videos.length > 0 && (
          unwatchedCount > 0 ? (
            <span className="text-xs text-orange-400/90 ml-0.5 font-medium" title="未視聴の動画数">
              未視聴 {unwatchedCount}
            </span>
          ) : (
            <span className="text-xs text-green-400/80 ml-0.5 font-medium" title="すべて視聴済み">
              ✓ 済
            </span>
          )
        )}
      </div>
      <div className="space-y-1.5">
        {videos
          .sort((a, b) => {
            const aIdx = channels.findIndex((c) => c.id === a.channelId);
            const bIdx = channels.findIndex((c) => c.id === b.channelId);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
          })
          .map((v) => (
          <VideoCard
            key={v.videoId}
            video={v}
            watched={watched.has(v.videoId)}
            watchedAt={watched.get(v.videoId) ?? null}
            onWatch={onWatch}
            channels={channels}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Login / Logout ─── */

function LoginForm({ compact }: { compact?: boolean }) {
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/oauth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.includes(".") ? handle : handle + ".bsky.social",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <span className="text-blue-400 text-xs">🦋</span>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="handle"
          className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 w-24"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !handle}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "..." : "Bluesky ログイン"}
        </button>
        {error && <span className="text-red-400 text-[10px]">{error}</span>}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="handle.bsky.social"
        className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 w-48"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading || !handle}
        className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
      >
        {loading ? "..." : "Bluesky でログイン"}
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </form>
  );
}

function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/oauth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-xs text-gray-500 hover:text-red-400 transition-colors"
    >
      {loading ? "..." : "サインアウト"}
    </button>
  );
}

/* ─── Ranking View ─── */

type RankingTab = "posts" | "popular" | "streak" | "stamps";

function RankingView({
  days,
  watched,
  channels,
  votes,
  streaks,
  stamps,
  userDid,
  onVote,
  defaultTab = "posts",
  onTabChange,
}: {
  days: DayVideos[];
  watched: WatchedMap;
  channels: Channel[];
  votes: Record<string, string[]>;
  streaks: Record<string, number>;
  stamps: Record<string, Record<string, number>>;
  userDid: string | null;
  onVote: (channelId: string) => void;
  defaultTab?: RankingTab;
  onTabChange?: (tab: RankingTab) => void;
}) {
  const [rankingTab, setRankingTab] = useState<RankingTab>(defaultTab);

  // Update URL when tab changes (for deeplinking)
  const updateTab = (tab: RankingTab) => {
    setRankingTab(tab);
    onTabChange?.(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  // Build per-channel stats
  const channelStats = new Map<string, { id: string; name: string; color: string; total: number; watched: number }>();
  for (const ch of channels) {
    channelStats.set(ch.id, { id: ch.id, name: ch.name, color: ch.color, total: 0, watched: 0 });
  }

  for (const day of days) {
    for (const video of day.videos) {
      const stat = channelStats.get(video.channelId);
      if (stat) {
        stat.total++;
        if (watched.has(video.videoId)) stat.watched++;
      }
    }
  }

  const channelList = Array.from(channelStats.values()).filter((s) => s.total > 0);

  // Sort by posts
  const byPosts = [...channelList].sort((a, b) => b.total - a.total);
  const maxTotal = byPosts.length > 0 ? byPosts[0].total : 1;

  return (
    <div className="mt-12 border-t border-gray-800 pt-8">
      <div className="max-w-3xl mx-auto">
        {/* Tab switcher */}
        <div className="flex justify-center mb-6">
          <div className="flex gap-1 bg-gray-800/50 rounded-full p-0.5 border border-gray-700/50">
            <button
              onClick={() => updateTab("posts")}
              className={`text-xs px-4 py-1.5 rounded-full transition-colors ${
                rankingTab === "posts"
                  ? "bg-gray-700 text-white font-medium"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              📊 投稿数
            </button>
            <button
              onClick={() => updateTab("streak")}
              className={`text-xs px-4 py-1.5 rounded-full transition-colors ${
                rankingTab === "streak"
                  ? "bg-orange-800/60 text-orange-200 font-medium"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              🔥 連続日数
            </button>
            <button
              onClick={() => updateTab("stamps")}
              className={`text-xs px-4 py-1.5 rounded-full transition-colors ${
                rankingTab === "stamps"
                  ? "bg-purple-800/60 text-purple-200 font-medium"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              🎯 スタンプ
            </button>
          </div>
        </div>

        {rankingTab === "posts" ? (
          <PostsRanking
            channels={byPosts}
            maxTotal={maxTotal}
          />
        ) : rankingTab === "streak" ? (
          <StreakRanking
            channels={channels}
            streaks={streaks}
          />
        ) : rankingTab === "stamps" ? (
          <StampRanking
            channels={channels}
            stamps={stamps}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ─── Posts Ranking ─── */

function PostsRanking({
  channels,
  maxTotal,
}: {
  channels: { id: string; name: string; color: string; total: number; watched: number }[];
  maxTotal: number;
}) {
  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-center mb-1">📊 投稿数ランキング</h2>
      <p className="text-gray-500 text-xs text-center mb-6">今月の動画投稿数順</p>
      <div className="space-y-3">
        {channels.map((ch, idx) => {
          const pct = maxTotal > 0 ? (ch.total / maxTotal) * 100 : 0;
          const watchedPct = ch.total > 0 ? (ch.watched / ch.total) * 100 : 0;
          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
          return (
            <div
              key={ch.name}
              className="bg-gray-800/40 border border-gray-700/30 rounded-lg px-4 py-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{medal}</span>
                  <span className="font-medium text-sm" style={{ color: ch.color }}>{ch.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-300 font-medium">{ch.total} 本</span>
                </div>
              </div>
              {/* Bar: total */}
              <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: ch.color }}
                />
              </div>
              {/* Watched */}
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>視聴済み: {ch.watched}/{ch.total} ({watchedPct.toFixed(0)}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Streak Ranking ─── */

function StreakRanking({
  channels,
  streaks,
}: {
  channels: Channel[];
  streaks: Record<string, number>;
}) {
  // Sort by streak descending
  const sorted = [...channels]
    .map((ch) => ({
      ...ch,
      streak: streaks[ch.id] || 0,
    }))
    .sort((a, b) => b.streak - a.streak);

  const maxStreak = sorted.length > 0 ? sorted[0].streak : 1;

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-center mb-1">🔥 連続投稿日数ランキング</h2>
      <p className="text-gray-500 text-xs text-center mb-1">何日連続で毎日投稿できているかの記録</p>
      <p className="text-gray-600 text-[10px] text-center mb-6">🔥数字は2026年以降の連続更新日数（24時間ごとに更新）</p>
      <div className="space-y-3">
        {sorted.map((ch, idx) => {
          const pct = maxStreak > 0 ? (ch.streak / maxStreak) * 100 : 0;
          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
          return (
            <div
              key={ch.name}
              className="bg-gray-800/40 border border-gray-700/30 rounded-lg px-4 py-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{medal}</span>
                  <span className="font-medium text-sm" style={{ color: ch.color }}>{ch.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-orange-400 font-bold">
                    🔥 {ch.streak}日連続
                  </span>
                </div>
              </div>
              {/* Streak bar */}
              <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: "#f97316" }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>目標: 365日</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Stamp Ranking ─── */

function StampRanking({
  channels,
  stamps,
}: {
  channels: Channel[];
  stamps: Record<string, Record<string, number>>;
}) {
  // Calculate total stamps per channel
  const withTotals = channels.map((ch) => {
    const s = stamps[ch.id] || {};
    const total = (s["👍"] || 0) + (s["🔥"] || 0) + (s["🎉"] || 0) + (s["❤️"] || 0);
    return { ...ch, total, details: s };
  }).sort((a, b) => b.total - a.total);

  const maxTotal = withTotals.length > 0 ? withTotals[0].total : 1;

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-center mb-1">🎯 スタンプランキング</h2>
      <p className="text-gray-500 text-xs text-center mb-1">月間累計の応援スタンプ数</p>
      <p className="text-gray-600 text-[10px] text-center mb-6">各スタンプは1日1回まで押せます（トグル式）</p>
      <div className="space-y-3">
        {withTotals.map((ch, idx) => {
          const pct = maxTotal > 0 ? (ch.total / maxTotal) * 100 : 0;
          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
          return (
            <div
              key={ch.name}
              className="bg-gray-800/40 border border-gray-700/30 rounded-lg px-4 py-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{medal}</span>
                  <span className="font-medium text-sm" style={{ color: ch.color }}>{ch.name}</span>
                </div>
                <span className="text-sm text-purple-400 font-bold">
                  🎯 {ch.total}
                </span>
              </div>
              {/* Stamp breakdown */}
              <div className="flex gap-2 mb-2 text-xs">
                {["👍", "🔥", "🎉", "❤️"].map((emoji) => (
                  <span key={emoji} className="text-gray-500">
                    {emoji} {ch.details[emoji] || 0}
                  </span>
                ))}
              </div>
              {/* Bar */}
              <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: "#a855f7" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function VlogCalendarClient({
  daysByMonth,
  channelsByMonth,
  error,
  updatedAt,
  userDid,
  userHandle,
  userDisplayName,
  userAvatar,
  votes: initialVotes,
  streaks,
  stamps: initialStamps,
  initialMonth,
  buildSha,
}: {
  daysByMonth: Record<string, DayVideos[]>;
  channelsByMonth: Record<string, Channel[]>;
  error: string | null;
  updatedAt: string;
  userDid: string | null;
  userHandle: string | null;
  userDisplayName: string | null;
  userAvatar: string | null;
  votes: Record<string, string[]>;
  streaks: Record<string, number>;
  stamps: Record<string, Record<string, number>>;
  initialMonth: string;
  buildSha?: string;
}) {
  const [watched, setWatched] = useState<WatchedMap>(new Map());
  const [showUnwatchedOnly, setShowUnwatchedOnly] = useState(false);

  // Read initial state from URL params for deeplinking
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialViewMode = tabParam === "posts" || tabParam === "popular" || tabParam === "streak" ? "ranking" : "calendar";
  const initialRankingTab = tabParam === "posts" || tabParam === "popular" || tabParam === "streak" ? tabParam : "posts";

  const [viewMode, setViewMode] = useState<"calendar" | "ranking">(initialViewMode);
  const [activeChannelFilter, setActiveChannelFilter] = useState<string | null>(null);
  const [subOpen, setSubOpen] = useState(false);
  const [voteState, setVoteState] = useState<Record<string, string[]>>(initialVotes);
  const [stampState, setStampState] = useState<Record<string, Record<string, number>>>(initialStamps);
  const [activeMonth, setActiveMonth] = useState<string>(initialMonth);
  const [visitCount, setVisitCount] = useState<number | null>(null);
  // セッションから選択を復元したか（初回マウント後に true → 以後 state 変更を保存）
  const [hydrated, setHydrated] = useState(false);
  // Remember last active ranking tab across view mode switches
  const [lastRankingTab, setLastRankingTab] = useState<RankingTab>(initialRankingTab);

  // トップページ累計アクセス数を取得（ヘッダー表示用）
  useEffect(() => {
    fetch("/api/visits")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.count === "number") setVisitCount(d.count);
      })
      .catch(() => {});
  }, []);

  // マウント時にセッションの選択を復元（リロードしても「未視聴のみ表示」等が保持される）
  // sessionStorage は SSR 時（サーバー・初回ハイドレーション）に読めないため、
  // デフォルトで描画した後に副作用で復元するのが hydration 不一致を防ぐ唯一の方法。
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const p = loadPrefs();
    const urlTab = searchParams.get("tab");
    // URL の ?tab= によるディープリンクが優先されるよう、view/ranking は tab パラメータがある時は上書きしない
    if (p.showUnwatchedOnly !== undefined) setShowUnwatchedOnly(p.showUnwatchedOnly);
    if (!urlTab) {
      if (p.viewMode) setViewMode(p.viewMode);
      if (p.lastRankingTab) setLastRankingTab(p.lastRankingTab);
    }
    if (p.activeChannelFilter !== undefined) setActiveChannelFilter(p.activeChannelFilter);
    if (p.activeMonth) setActiveMonth(p.activeMonth);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 選択の変更をセッションへ保存（復元完了後）
  useEffect(() => {
    if (!hydrated) return;
    savePrefs({ showUnwatchedOnly, viewMode, activeChannelFilter, activeMonth, lastRankingTab });
  }, [hydrated, showUnwatchedOnly, viewMode, activeChannelFilter, activeMonth, lastRankingTab]);

  // Streaks are pre-computed server-side and cached in Redis
  const allChannels = Object.values(channelsByMonth)
    .flat()
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);

  // Active month data for calendar rendering
  const activeDays = daysByMonth[activeMonth] || [];
  const activeChannels = (channelsByMonth[activeMonth] || [])
    .sort((a, b) => (streaks[b.id] || 0) - (streaks[a.id] || 0));

  // Session keepalive: ping every 5 minutes while logged in
  useEffect(() => {
    if (!userDid) return;
    const interval = setInterval(async () => {
      try {
        await fetch("/api/session/ping");
      } catch {
        // silent
      }
    }, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [userDid]);

  // Load watched state on mount
  useEffect(() => {
    (async () => {
      // If logged in, try API first
      if (userDid) {
        const apiData = await loadWatchedApi();
        if (apiData && apiData.size > 0) {
          // API has data — use it and cache locally
          setWatched(apiData);
          saveWatchedLocal(apiData);
          return;
        }
        // API is empty but we have local data — migrate it
        const migrated = await migrateLocalToApi();
        if (migrated && migrated.size > 0) {
          setWatched(migrated);
          saveWatchedLocal(migrated);
          return;
        }
        // No local data either — try localStorage directly
        setWatched(loadWatchedLocal());
        return;
      }
      // Fallback: localStorage
      setWatched(loadWatchedLocal());
    })();
  }, [userDid]);

  const handleStamp = useCallback(async (videoId: string, stamp: string) => {
    // Optimistic toggle
    setStampState((prev) => {
      const next = { ...prev };
      const ch = { ...(next[videoId] || { "👍": 0, "🔥": 0, "🎉": 0, "❤️": 0 }) };
      // We don't know if it's add or remove yet, so optimistically +1
      ch[stamp] = (ch[stamp] || 0) + 1;
      next[videoId] = ch;
      return next;
    });
    try {
      const res = await fetch("/api/stamps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, stamp }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Revert on failure
        setStampState((prev) => {
          const next = { ...prev };
          const ch = { ...(next[videoId] || { "👍": 0, "🔥": 0, "🎉": 0, "❤️": 0 }) };
          ch[stamp] = Math.max(0, (ch[stamp] || 0) - 1);
          next[videoId] = ch;
          return next;
        });
        return;
      }
      // Sync with server counts
      setStampState((prev) => {
        const next = { ...prev };
        next[videoId] = data.counts;
        return next;
      });
    } catch {
      // Revert
      setStampState((prev) => {
        const next = { ...prev };
        const ch = { ...(next[videoId] || { "👍": 0, "🔥": 0, "🎉": 0, "❤️": 0 }) };
        ch[stamp] = Math.max(0, (ch[stamp] || 0) - 1);
        next[videoId] = ch;
        return next;
      });
    }
  }, []);

  const handleVote = useCallback(async (channelId: string) => {
    if (!userDid) {
      alert("投票するにはログインが必要です");
      return;
    }
    // Optimistic update
    const prevVote = voteState;
    setVoteState((prev) => {
      const next = { ...prev };
      const arr = next[channelId] || [];
      if (arr.includes(userDid)) {
        next[channelId] = arr.filter((d) => d !== userDid);
      } else {
        next[channelId] = [...arr, userDid];
      }
      return next;
    });
    // Sync to API
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, month: activeMonth }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Revert optimistic update
        setVoteState(prevVote);
        alert(data.error || "投票に失敗しました");
        return;
      }
      setVoteState(data.votes);
    } catch {
      setVoteState(prevVote);
    }
  }, [userDid, voteState]);

  const handleWatch = useCallback(async (videoId: string) => {
    const now = new Date().toISOString();

    // Optimistic local update
    setWatched((prev) => {
      const next = new Map(prev);
      next.set(videoId, now);
      saveWatchedLocal(next);
      return next;
    });

    // If logged in, sync to API
    if (userDid) {
      const apiData = await markWatchedApi(videoId);
      if (apiData) {
        setWatched(apiData);
        saveWatchedLocal(apiData);
      }
    }
  }, [userDid]);

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

  // Build a map of date->videos for the active month
  const monthPrefix = activeMonth;
  const daysInMonthNum = daysInMonth(activeMonth);
  const videoMap = new Map(activeDays.map((d) => [d.date, d.videos]));
  const monthDates = Array.from({ length: daysInMonthNum }, (_, i) => {
    const day = i + 1;
    const dateStr = `${monthPrefix}-${String(day).padStart(2, "0")}`;
    return { date: dateStr, videos: videoMap.get(dateStr) || [] };
  });

  const totalVideos = activeDays.reduce((s, d) => s + d.videos.length, 0);
  const watchedCount = activeDays.reduce(
    (s, d) => s + d.videos.filter((v) => watched.has(v.videoId)).length,
    0
  );
  const unwatchedCount = totalVideos - watchedCount;

  // 今日の更新ハイライト（JST基準で当日の動画があれば表示。月判定はしない）
  const todayStr = todayJstDate();
  const todayVideos = activeDays
    .filter((d) => d.date === todayStr)
    .flatMap((d) => d.videos)
    .sort((a, b) => (a.channelName || "").localeCompare(b.channelName || ""));

  const themeClass = `theme-${monthKey(activeMonth)}`;

  return (
    <div
      className={`min-h-screen text-white ${themeClass}`}
    >
      <Tour />
      <header className="border-b theme-header-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Title row */}
          <div className="relative text-center">
            <img
              src="/logo-desubro.png"
              alt="デスブロカレンダー"
              className="w-full max-w-[500px] mx-auto object-contain"
            />
          </div>
          {/* Login widget — right-aligned on md+, below title on mobile */}
          <div
            data-tour="bluesky-login"
            className="flex justify-end mt-3 md:absolute md:right-0 md:top-0 md:mt-0 shrink-0 text-right"
          >
            {userDid ? (
              <div className="flex items-center gap-2">
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt=""
                    className="w-6 h-6 rounded-full ring-1 ring-blue-500/30"
                  />
                ) : (
                  <span className="text-blue-400 text-sm">🦋</span>
                )}
                <span className="text-xs text-gray-300 truncate max-w-[100px]">
                  {userDisplayName || userHandle}
                </span>
                <LogoutButton />
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <LoginForm compact />
                <p className="text-[10px] text-gray-600 leading-tight">
                  ログインすると既読管理ができたりして便利ですよ
                </p>
              </div>
            )}
          </div>
          {visitCount !== null && (
            <p className="text-right md:absolute md:right-0 md:top-12 md:mt-0 mt-1 text-[10px] text-gray-600">
              👀 累計 {visitCount.toLocaleString()} 回表示
            </p>
          )}
          <p className="text-center text-gray-400 mt-2 text-sm">
            1ヶ月毎日Vlogを投稿できるかチャレンジしているメンバーのアドベントカレンダーです。
          </p>
          <p className="text-center text-gray-500 mt-1 text-xs">
            参加希望メンバーはドリキンに連絡ください
          </p>
          {totalVideos > 0 && (
            <div className="max-w-sm mx-auto mt-4" data-tour="watched-bar">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{showUnwatchedOnly ? "未視聴" : "視聴済み"}</span>
                <span className="text-green-400 font-medium">
                  {showUnwatchedOnly
                    ? `${unwatchedCount} 本残り`
                    : `${watchedCount} / ${totalVideos}`}
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${(watchedCount / totalVideos) * 100}%` }}
                />
              </div>
            </div>
          )}
          {/* Member cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
            {activeChannels.map((ch) => {
              const isActive = activeChannelFilter === ch.id;
              const streak = streaks[ch.id] || 0;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannelFilter(isActive ? null : ch.id)}
                  className={`group relative rounded-xl border p-3 text-center transition-all ${
                    isActive
                      ? "bg-white/10 border-white/30 shadow-lg shadow-white/5 ring-1 ring-white/20"
                      : "bg-black/30 border-gray-800 hover:border-gray-600 hover:bg-black/40"
                  }`}
                >
                  {/* Avatar */}
                  <div className="mx-auto mb-2 w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-white/20 transition-all">
                    {ch.avatar ? (
                      <img
                        src={ch.avatar}
                        alt={ch.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-lg font-bold"
                        style={{ backgroundColor: ch.color + "40" }}
                      >
                        {ch.name[0]}
                      </div>
                    )}
                  </div>
                  {/* Name */}
                  <p className={`text-xs font-medium truncate mb-1 ${
                    isActive ? "text-white" : "text-gray-300"
                  }`}>
                    {ch.name}
                  </p>
                  {/* Streak */}
                  {streak > 0 && (
                    <p
                      data-tour="streak-counter"
                      className="text-[11px] text-orange-400/80 font-medium mb-1.5"
                    >🔥 連続{streak}日</p>
                  )}
                  {/* Stamp buttons - hidden: now per-video in Today's Updates */}
                  <div className="hidden flex justify-center gap-1">
                    {["👍", "🔥", "🎉", "❤️"].map((emoji, si) => {
                      const count = stampState[ch.id]?.[emoji] || 0;
                      return (
                        <button
                          key={emoji}
                          data-tour={si === 0 && emoji === "👍" ? "stamp-btn" : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStamp(ch.id, emoji);
                          }}
                          className="text-xs px-1 py-0.5 rounded-md bg-white/5 hover:bg-white/15 transition-colors min-w-[28px] text-center"
                          title={`${emoji} を送る`}
                        >
                          <span className="leading-none">{emoji}</span>
                          {count > 0 && (
                            <span className="text-[10px] text-gray-400 ml-0.5">{count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
          {activeChannels.some((ch) => streaks[ch.id] > 0) && (
            <p className="text-center text-gray-600 text-[10px] mt-2">
              🔥数字は2026年以降の連続更新日数（24時間ごとに自動更新）
            </p>
          )}
          {/* Channel subscription list */}
          <div className="mt-6 max-w-lg mx-auto">
            <button
              onClick={() => setSubOpen(!subOpen)}
              className="mx-auto block text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              📺 チャンネル一覧 {subOpen ? "▲" : "▼"}
            </button>
            {subOpen && (
              <div className="mt-3 space-y-1.5">
                {activeChannels
                  .sort((a, b) => (streaks[b.id] || 0) - (streaks[a.id] || 0))
                  .map((ch) => (
                  <a
                    key={ch.id}
                    href={`https://www.youtube.com/channel/${ch.id}?sub_confirmation=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: ch.color }}
                    />
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors truncate">
                      {ch.name}
                    </span>
                    {streaks[ch.id] > 0 && (
                      <span className="text-xs text-orange-400 ml-auto shrink-0">🔥{streaks[ch.id]}</span>
                    )}
                    <span className="text-gray-600 group-hover:text-red-400 transition-colors text-xs ml-auto shrink-0">
                      登録 ➜
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
          {activeChannelFilter && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => setActiveChannelFilter(null)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                ✕ フィルター解除
              </button>
            </div>
          )}
          <div className="flex justify-center mt-3 gap-2" data-tour="month-tabs">
            {/* Month tabs — generated from MONTHS */}
            <div className="flex gap-1 bg-gray-800/50 rounded-full p-0.5 border border-gray-700/50 overflow-x-auto max-w-full">
              {MONTHS.map((m) => {
                const isActive = activeMonth === m;
                return (
                  <button
                    key={m}
                    onClick={() => setActiveMonth(m)}
                    className={`text-xs px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-gray-700 text-white font-medium"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {monthLabel(m)}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowUnwatchedOnly(!showUnwatchedOnly)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                showUnwatchedOnly
                  ? "bg-green-900/40 text-green-400 border-green-700/50"
                  : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-500"
              }`}
            >
              {showUnwatchedOnly ? "🟢 未視聴のみ表示中" : "⚪ 全動画表示"}
            </button>
            <button
              data-tour="ranking-btn"
              onClick={() => {
                const newMode = viewMode === "calendar" ? "ranking" : "calendar";
                setViewMode(newMode);
                // Update URL for deeplinking
                const url = new URL(window.location.href);
                if (newMode === "ranking") {
                  url.searchParams.set("tab", lastRankingTab);
                } else {
                  url.searchParams.delete("tab");
                }
                window.history.replaceState({}, "", url.toString());
              }}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                viewMode === "ranking"
                  ? "bg-amber-900/40 text-amber-400 border-amber-700/50"
                  : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-500"
              }`}
            >
              {viewMode === "ranking" ? "📊 ランキング表示中" : "📊 ランキング"}
            </button>
          </div>
          <p className="text-center text-gray-600 text-xs mt-3">
            Last updated: {updatedAt.split(".")[0].replace("T", " ")}
            {buildSha ? ` · build ${buildSha}` : ""}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {viewMode === "ranking" ? (
          <RankingView days={activeDays} watched={watched} channels={activeChannels} votes={voteState} streaks={streaks} stamps={stampState} userDid={userDid} onVote={handleVote} defaultTab={lastRankingTab} onTabChange={(tab: RankingTab) => setLastRankingTab(tab)} />
        ) : (
          <>
          {/* 今日の更新ハイライト */}
          {todayVideos.length > 0 && (
            <section className="mb-6" data-tour="today-updates">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">✨</span>
                <h2 className="text-base md:text-lg font-bold text-white">今日の更新</h2>
                <span className="text-xs text-gray-500">{todayVideos.length} 本</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {todayVideos.map((v) => (
                  <a
                    key={v.videoId}
                    href={`https://www.youtube.com/watch?v=${v.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleWatch(v.videoId)}
                    className="group relative rounded-xl overflow-hidden border border-orange-500/30 bg-black/40 hover:border-orange-400/60 transition-all"
                  >
                    <div className="aspect-video bg-gray-900 relative">
                      {v.thumbnail ? (
                        <img
                          src={v.thumbnail}
                          alt={v.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No img</div>
                      )}
                      {watched.has(v.videoId) && (
                        <div className="absolute top-1.5 right-1.5 bg-green-600/90 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                          視聴済
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] text-orange-300/90 font-medium truncate">{v.channelName}</p>
                      <p className="text-xs text-gray-300 line-clamp-2 leading-tight mt-0.5">{v.title}</p>
                      {/* Stamp buttons for this video */}
                      <div className="flex justify-start gap-1 mt-1.5">
                        {["👍", "🔥", "🎉", "❤️"].map((emoji, si) => {
                          const count = stampState[v.videoId]?.[emoji] || 0;
                          return (
                            <button
                              key={emoji}
                              data-tour={si === 0 && emoji === "👍" && v === todayVideos[0] ? "stamp-btn" : undefined}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStamp(v.videoId, emoji);
                              }}
                              className="text-xs px-1 py-0.5 rounded-md bg-white/5 hover:bg-white/15 transition-colors min-w-[28px] text-center"
                              title={`${emoji} を送る`}
                            >
                              <span className="leading-none">{emoji}</span>
                              {count > 0 && (
                                <span className="text-[10px] text-gray-400 ml-0.5">{count}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

        <div className="hidden md:grid md:grid-cols-5 lg:grid-cols-7 gap-2">
          {monthDates.map(({ date, videos }) => {
            let filtered = showUnwatchedOnly
              ? videos.filter((v) => !watched.has(v.videoId))
              : videos;
            if (activeChannelFilter) {
              filtered = filtered.filter((v) => v.channelId === activeChannelFilter);
            }
            return (
              <DayCell key={date} date={date} videos={filtered} watched={watched} onWatch={handleWatch} channels={activeChannels} />
            );
          })}
        </div>

        <div className="md:hidden space-y-4">
          {monthDates
            .map(({ date, videos }) => {
              let filtered = showUnwatchedOnly
                ? videos.filter((v) => !watched.has(v.videoId))
                : videos;
              if (activeChannelFilter) {
                filtered = filtered.filter((v) => v.channelId === activeChannelFilter);
              }
              return { date, videos: filtered };
            })
            .filter((d) => d.videos.length > 0)
            .map(({ date, videos }) => (
              <DayCell key={date} date={date} videos={videos} watched={watched} onWatch={handleWatch} channels={activeChannels} />
            ))}
        </div>
          </>
        )}

      </main>

      <footer className="border-t border-gray-800 py-4 text-center text-gray-600 text-xs">
        Made with ❤️ for デスブロカレンダー 2026
      </footer>
    </div>
  );
}
