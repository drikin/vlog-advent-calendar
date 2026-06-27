"use client";

import { useEffect, useState, useCallback } from "react";
import type { DayVideos, YouTubeVideo } from "@/lib/youtube";
import type { Channel } from "@/config/channels";

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

/* ─── RSVP types ─── */

type RsvpStatus = "confirmed" | "maybe" | "interested";

interface RsvpEntry {
  name: string;
  did: string;
  status: RsvpStatus;
  comment: string;
  createdAt: string;
}

const STATUS_LABELS: Record<RsvpStatus, string> = {
  confirmed: "✅ 確定",
  maybe: "🔄 参加予定（調整中）",
  interested: "🤔 参加希望",
};

const STATUS_ORDER: RsvpStatus[] = ["confirmed", "maybe", "interested"];

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
            watched ? "" : "group-hover:scale-105"
          }`}
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

function LoginForm() {
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

/* ─── RSVP Manager ─── */

function RsvpManager({
  userDid,
  userHandle,
  userDisplayName,
}: {
  userDid: string | null;
  userHandle: string | null;
  userDisplayName: string | null;
}) {
  const [entries, setEntries] = useState<RsvpEntry[]>([]);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<RsvpStatus>("confirmed");
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load from API on mount
  useEffect(() => {
    fetch("/api/rsvp")
      .then((r) => r.json())
      .then((data) => {
        if (data.entries) setEntries(data.entries);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    fetch("/api/rsvp")
      .then((r) => r.json())
      .then((data) => {
        if (data.entries) setEntries(data.entries);
      })
      .catch(() => {});
  }, []);

  // Pre-fill name from user's existing entry
  const userEntry = entries.find((e) => e.did === userDid);
  const isLoggedIn = !!userDid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) return;

    const trimmed = (userDisplayName ?? userHandle ?? "").trim();
    if (!trimmed) return;

    setSubmitError(null);

    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, status, comment: comment.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "登録に失敗しました");
        return;
      }
      if (data.entries) setEntries(data.entries);
    } catch {
      setSubmitError("通信エラーが発生しました");
    }

    setComment("");
    setStatus("confirmed");
  };

  const handleDelete = async () => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch("/api/rsvp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.entries) setEntries(data.entries);
    } catch {}
  };

  // Sort: confirmed first, then maybe, then interested
  const sorted = [...entries].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  );

  const counts = {
    confirmed: entries.filter((e) => e.status === "confirmed").length,
    maybe: entries.filter((e) => e.status === "maybe").length,
    interested: entries.filter((e) => e.status === "interested").length,
    total: entries.length,
  };

  return (
    <div className="mt-16 border-t border-gray-800 pt-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold">
            🎓 デスブログ卒業式 オフ会
          </h2>
          <p className="text-gray-400 mt-1 text-sm">
            2026年7月4日（土） — 詳細調整中。参加希望の方は登録してください！
          </p>
        </div>

        {/* Status summary */}
        <div className="flex flex-wrap justify-center gap-3 mb-6 text-sm">
          <span className="bg-green-900/40 text-green-400 px-3 py-1 rounded-full border border-green-800/50">
            ✅ 確定: {counts.confirmed}
          </span>
          <span className="bg-yellow-900/40 text-yellow-400 px-3 py-1 rounded-full border border-yellow-800/50">
            🔄 調整中: {counts.maybe}
          </span>
          <span className="bg-blue-900/40 text-blue-400 px-3 py-1 rounded-full border border-blue-800/50">
            🤔 希望: {counts.interested}
          </span>
          <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full border border-gray-700">
            計: {counts.total}名
          </span>
        </div>

        {/* Form — only shown when logged in */}
        {isLoggedIn ? (
          <form onSubmit={handleSubmit} className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <input
                type="text"
                placeholder="表示名"
                value={userDisplayName ?? ""}
                disabled
                className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white/70 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 cursor-not-allowed"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RsvpStatus)}
                className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="confirmed">✅ 確定</option>
                <option value="maybe">🔄 参加予定（調整中）</option>
                <option value="interested">🤔 参加希望</option>
              </select>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {userEntry ? "更新する" : "登録する"}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="一言コメント（任意）"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="flex-1 bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
              />
              {userEntry && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors px-2"
                >
                  参加を取り消す
                </button>
              )}
            </div>
            {submitError && (
              <p className="mt-2 text-red-400 text-xs">{submitError}</p>
            )}
          </form>
        ) : (
          <div className="bg-gray-800/20 border border-dashed border-gray-700/50 rounded-lg p-6 mb-6 text-center">
            <p className="text-gray-500 text-sm mb-3">
              参加登録するには Bluesky アカウントでログインしてください
            </p>
            <LoginForm />
          </div>
        )}

        {/* Participant list */}
        <div className="space-y-2">
          {loading && (
            <p className="text-center text-gray-600 text-sm">読み込み中...</p>
          )}
          {!loading && sorted.length === 0 && (
            <p className="text-center text-gray-600 text-sm">まだ参加者は登録されていません</p>
          )}
          {sorted.map((entry, idx) => {
            const isOwner = entry.did === userDid;
            return (
              <div
                key={`${entry.name}-${entry.createdAt}`}
                className={`rounded-lg px-4 py-3 flex items-start justify-between gap-3 ${
                  isOwner
                    ? "bg-blue-900/20 border border-blue-700/40"
                    : "bg-gray-800/30 border border-gray-700/30"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-white">
                      {entry.name}
                      {isOwner && (
                        <span className="text-blue-400 text-xs ml-1">(あなた)</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">{STATUS_LABELS[entry.status]}</span>
                  </div>
                  {entry.comment && (
                    <p className="text-xs text-gray-400">{entry.comment}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Ranking View ─── */

function RankingView({
  days,
  watched,
  channels,
}: {
  days: DayVideos[];
  watched: WatchedMap;
  channels: Channel[];
}) {
  // Build per-channel stats
  const channelStats = new Map<string, { name: string; color: string; total: number; watched: number }>();
  for (const ch of channels) {
    channelStats.set(ch.id, { name: ch.name, color: ch.color, total: 0, watched: 0 });
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

  const sorted = Array.from(channelStats.values())
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total);

  const maxTotal = sorted.length > 0 ? sorted[0].total : 1;

  return (
    <div className="mt-12 border-t border-gray-800 pt-8">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-center mb-2">🏆 更新頻度ランキング</h2>
        <p className="text-gray-500 text-xs text-center mb-6">6月の動画投稿数順</p>
        <div className="space-y-3">
          {sorted.map((ch, idx) => {
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
                  <span className="text-sm text-gray-300 font-medium">{ch.total} 本</span>
                </div>
                {/* Bar: total */}
                <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: ch.color }}
                  />
                </div>
                {/* Watched overlay */}
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>視聴済み: {ch.watched}/{ch.total}</span>
                  <span>{watchedPct.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── CTA Bar ─── */

function CtaBar() {
  const scrollToRsvp = () => {
    const el = document.getElementById("rsvp-section");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="border-b border-amber-900/40 bg-gradient-to-r from-amber-950/30 via-yellow-950/20 to-amber-950/30">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-3">
        <span className="text-sm text-amber-300/90">
          🎓 <strong>デスブログ卒業式 オフ会</strong> 参加希望の方はこちら
        </span>
        <button
          onClick={scrollToRsvp}
          className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors shadow-lg shadow-amber-900/30"
        >
          👇 参加表明する
        </button>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function VlogCalendarClient({
  days,
  error,
  channels,
  updatedAt,
  userDid,
  userHandle,
  userDisplayName,
}: {
  days: DayVideos[];
  error: string | null;
  channels: Channel[];
  updatedAt: string;
  userDid: string | null;
  userHandle: string | null;
  userDisplayName: string | null;
}) {
  const [watched, setWatched] = useState<WatchedMap>(new Map());
  const [showUnwatchedOnly, setShowUnwatchedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "ranking">("calendar");
  const [activeChannelFilter, setActiveChannelFilter] = useState<string | null>(null);

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
  const unwatchedCount = totalVideos - watchedCount;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <CtaBar />
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
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {channels.map((ch) => {
              const isActive = activeChannelFilter === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannelFilter(isActive ? null : ch.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    isActive
                      ? "bg-white/10 border-white/30 text-white font-medium shadow-lg"
                      : "border-gray-700 hover:border-gray-500"
                  }`}
                  style={!isActive ? { borderColor: ch.color + "40", color: ch.color } : {}}
                >
                  {ch.name}
                </button>
              );
            })}
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
          <div className="flex justify-center mt-3 gap-2">
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
              onClick={() => setViewMode(viewMode === "calendar" ? "ranking" : "calendar")}
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
            Last updated: {new Date(updatedAt).toLocaleString("ja-JP")}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {viewMode === "ranking" ? (
          <RankingView days={days} watched={watched} channels={channels} />
        ) : (
          <>
        <div className="hidden md:grid md:grid-cols-5 lg:grid-cols-7 gap-3">
          {juneDates.map(({ date, videos }) => {
            let filtered = showUnwatchedOnly
              ? videos.filter((v) => !watched.has(v.videoId))
              : videos;
            if (activeChannelFilter) {
              filtered = filtered.filter((v) => v.channelId === activeChannelFilter);
            }
            return (
              <DayCell key={date} date={date} videos={filtered} watched={watched} onWatch={handleWatch} channels={channels} />
            );
          })}
        </div>

        <div className="md:hidden space-y-4">
          {juneDates
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
              <DayCell key={date} date={date} videos={videos} watched={watched} onWatch={handleWatch} channels={channels} />
            ))}
        </div>
          </>
        )}

        {/* RSVP Section — デスブログ卒業式 オフ会 */}
        <div id="rsvp-section">
          <RsvpManager userDid={userDid} userHandle={userHandle} userDisplayName={userDisplayName} />
        </div>
      </main>

      <footer className="border-t border-gray-800 py-4 text-center text-gray-600 text-xs">
        Made with ❤️ for BSM地獄のVLOG強化月間 2026.06
      </footer>
    </div>
  );
}
