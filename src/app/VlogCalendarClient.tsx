"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
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

type RankingTab = "posts" | "popular" | "streak";

function RankingView({
  days,
  watched,
  channels,
  votes,
  streaks,
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

  // Sort by votes
  const byVotes = [...channelList].sort((a, b) => {
    const va = votes[a.id]?.length || 0;
    const vb = votes[b.id]?.length || 0;
    if (vb !== va) return vb - va;
    return b.total - a.total; // tiebreaker: posts
  });
  const maxVotes = byVotes.length > 0 ? (votes[byVotes[0].id]?.length || 0) : 1;

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
              onClick={() => updateTab("popular")}
              className={`text-xs px-4 py-1.5 rounded-full transition-colors ${
                rankingTab === "popular"
                  ? "bg-pink-800/60 text-pink-200 font-medium"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              ❤️ 人気
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
          </div>
        </div>

        {rankingTab === "posts" ? (
          <PostsRanking
            channels={byPosts}
            maxTotal={maxTotal}
            votes={votes}
            userDid={userDid}
            onVote={onVote}
          />
        ) : rankingTab === "streak" ? (
          <StreakRanking
            channels={channels}
            streaks={streaks}
            votes={votes}
            userDid={userDid}
            onVote={onVote}
          />
        ) : (
          <PopularRanking
            channels={byVotes}
            maxVotes={maxVotes}
            votes={votes}
            userDid={userDid}
            onVote={onVote}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Posts Ranking ─── */

function PostsRanking({
  channels,
  maxTotal,
  votes,
  userDid,
  onVote,
}: {
  channels: { id: string; name: string; color: string; total: number; watched: number }[];
  maxTotal: number;
  votes: Record<string, string[]>;
  userDid: string | null;
  onVote: (channelId: string) => void;
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
          const voteCount = votes[ch.id]?.length || 0;
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
              {/* Watched + votes */}
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>視聴済み: {ch.watched}/{ch.total} ({watchedPct.toFixed(0)}%)</span>
                <span>❤️ {voteCount}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Popular Ranking ─── */

function PopularRanking({
  channels,
  maxVotes,
  votes,
  userDid,
  onVote,
}: {
  channels: { id: string; name: string; color: string; total: number; watched: number }[];
  maxVotes: number;
  votes: Record<string, string[]>;
  userDid: string | null;
  onVote: (channelId: string) => void;
}) {
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const myTotalVotes = userDid ? Object.values(votes).filter((v) => v.includes(userDid)).length : 0;
  const remainingVotes = Math.max(0, 3 - myTotalVotes);

  const handleVoteClick = (channelId: string) => {
    if (!userDid) {
      setShowLoginPrompt(true);
      return;
    }
    onVote(channelId);
  };

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-center mb-1">❤️ 人気チャンネルランキング</h2>
      <p className="text-gray-500 text-xs text-center mb-1">応援❤️が多い順</p>

      {/* Rules card */}
      <div className="max-w-lg mx-auto mb-6 bg-gray-800/30 border border-gray-700/30 rounded-lg p-4 text-xs text-gray-400 space-y-1.5">
        <p className="text-gray-300 font-medium mb-1">📋 投票ルール</p>
        <p>• 各チャンネルの ❤️ ボタンを押して応援しよう！</p>
        <p>• 1人 <strong className="text-pink-400">最大3チャンネル</strong> まで投票できます</p>
        <p>• もう一度押すと投票を取り消せます（枠が戻るよ）</p>
        <p>• 投票するには <strong className="text-blue-400">Bluesky アカウント</strong> でログインが必要です</p>
      </div>

      {userDid && (
        <p className="text-gray-500 text-xs text-center mb-4">
          残り投票枠: <span className="text-pink-400 font-medium">{remainingVotes}</span>/3
        </p>
      )}
      {!userDid && (
        <p className="text-gray-500 text-xs text-center mb-6">
          ログインして❤️で応援しよう！
        </p>
      )}
      {/* Login prompt overlay */}
      {showLoginPrompt && !userDid && (
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-6 mb-6 text-center">
          <p className="text-gray-300 text-sm mb-3">
            ❤️ で応援するにはログインが必要です
          </p>
          <LoginForm />
          <button
            onClick={() => setShowLoginPrompt(false)}
            className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            キャンセル
          </button>
        </div>
      )}
      <div className="space-y-3">
        {channels.map((ch, idx) => {
          const voteCount = votes[ch.id]?.length || 0;
          const hasVoted = userDid ? (votes[ch.id] || []).includes(userDid) : false;
          const pct = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;
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
                  <button
                    onClick={() => handleVoteClick(ch.id)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all ${
                      hasVoted
                        ? "bg-pink-900/40 text-pink-400 border-pink-700/50 shadow-lg shadow-pink-900/20"
                        : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-pink-500/50 hover:text-pink-400"
                    }`}
                  >
                    <span>{hasVoted ? "❤️" : "🤍"}</span>
                    <span>{voteCount}</span>
                  </button>
                  <span className="text-xs text-gray-500">{ch.total} 本</span>
                </div>
              </div>
              {/* Vote bar */}
              <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: "#f472b6" }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>投稿: {ch.total}本</span>
                <span>視聴率: {ch.total > 0 ? ((ch.watched / ch.total) * 100).toFixed(0) : 0}%</span>
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
  votes,
  userDid,
  onVote,
}: {
  channels: Channel[];
  streaks: Record<string, number>;
  votes: Record<string, string[]>;
  userDid: string | null;
  onVote: (channelId: string) => void;
}) {
  // Sort by streak descending, then by total posts as tiebreaker
  const sorted = [...channels]
    .map((ch) => ({
      ...ch,
      streak: streaks[ch.id] || 0,
      voteCount: votes[ch.id]?.length || 0,
    }))
    .sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      return b.voteCount - a.voteCount;
    });

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
                <span>❤️ {ch.voteCount}</span>
                <span>目標: 365日</span>
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
  juneDays,
  julyDays,
  error,
  channels,
  channelsJuly,
  updatedAt,
  userDid,
  userHandle,
  userDisplayName,
  userAvatar,
  votes,
  streaks,
}: {
  juneDays: DayVideos[];
  julyDays: DayVideos[];
  error: string | null;
  channels: Channel[];
  channelsJuly: Channel[];
  updatedAt: string;
  userDid: string | null;
  userHandle: string | null;
  userDisplayName: string | null;
  userAvatar: string | null;
  votes: Record<string, string[]>;
  streaks: Record<string, number>;
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
  const [voteState, setVoteState] = useState<Record<string, string[]>>(votes);
  const [activeMonth, setActiveMonth] = useState<"june" | "july">("july");

  // Streaks are pre-computed server-side and cached in Redis
  const allChannels = useMemo(
    () => [...channels, ...channelsJuly].filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i),
    [channels, channelsJuly]
  );

  // Active month data for calendar rendering
  const activeDays = activeMonth === "june" ? juneDays : julyDays;
  const activeChannels = activeMonth === "june" ? channels : channelsJuly;
  const [julyUnlocked, setJulyUnlocked] = useState(true);
  // Remember last active ranking tab across view mode switches
  const [lastRankingTab, setLastRankingTab] = useState<RankingTab>(initialRankingTab);

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
        body: JSON.stringify({ channelId, month: activeMonth === "june" ? "2026-06" : "2026-07" }),
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
  const monthPrefix = activeMonth === "june" ? "2026-06" : "2026-07";
  const monthLabel = activeMonth === "june" ? "2026.06" : "2026.07";
  const daysInMonth = activeMonth === "june" ? 30 : 31;

  const videoMap = new Map(activeDays.map((d) => [d.date, d.videos]));
  const monthDates = Array.from({ length: daysInMonth }, (_, i) => {
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Title row with login widget */}
          <div className="relative flex items-center justify-center">
            <h1 className="text-2xl md:text-3xl font-bold text-center">
              📹 デスブロカレンダー
              <span className="text-gray-400 font-normal ml-2">{monthLabel}</span>
            </h1>
            {/* Login widget — top-right */}
            <div className="absolute right-0 top-0 shrink-0 text-right">
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
          </div>
          <p className="text-center text-gray-400 mt-2 text-sm">
            1ヶ月毎日Vlogを投稿できるかチャレンジしているメンバーのアドベントカレンダーです。
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
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 mt-4">
            {activeChannels.map((ch) => {
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
                  {streaks[ch.id] > 0 && (
                    <span className="ml-1" title="2026年以降の連続更新日数">🔥{streaks[ch.id]}</span>
                  )}
                </button>
              );
            })}
          </div>
          {activeChannels.some((ch) => streaks[ch.id] > 0) && (
            <p className="text-center text-gray-600 text-[10px] mt-2">
              🔥数字は2026年以降の連続更新日数（24時間ごとに更新）
            </p>
          )}
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
            {/* Month tabs */}
            <div className="flex gap-1 bg-gray-800/50 rounded-full p-0.5 border border-gray-700/50">
              <button
                onClick={() => setActiveMonth("june")}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  activeMonth === "june"
                    ? "bg-gray-700 text-white font-medium"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                2026.06
              </button>
              {julyUnlocked && (
                <button
                  onClick={() => setActiveMonth("july")}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    activeMonth === "july"
                      ? "bg-amber-700 text-amber-100 font-medium"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  2026.07
                </button>
              )}
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
            Last updated: {new Date(updatedAt).toLocaleString("ja-JP")}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {viewMode === "ranking" ? (
          <RankingView days={activeDays} watched={watched} channels={activeChannels} votes={voteState} streaks={streaks} userDid={userDid} onVote={handleVote} defaultTab={lastRankingTab} onTabChange={(tab: RankingTab) => setLastRankingTab(tab)} />
        ) : (
          <>
        <div className="hidden md:grid md:grid-cols-5 lg:grid-cols-7 gap-3">
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
