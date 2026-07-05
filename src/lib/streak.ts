import type { YouTubeVideo } from "./youtube";
import type { Channel } from "@/config/channels";

const STREAK_2026_START = new Date("2026-01-01T00:00:00+09:00").getTime(); // JST 2026-01-01

/**
 * Convert UTC publishedAt string to JST date string (YYYY-MM-DD).
 */
function toJstDate(publishedAt: string): string {
  const d = new Date(publishedAt);
  // JST = UTC + 9h
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/**
 * Calculate streak using time-based gap detection.
 *
 * All date logic is JST-based to correctly handle videos published
 * around midnight UTC that land on the next day in Japan time.
 * A gap ≤ 48 hours is considered "continuous" — this absorbs timezone
 * shifts and travel gaps while still catching real breaks.
 */
export function calculateStreakFromVideos(
  videos: YouTubeVideo[],
  channelId: string
): number {
  // Get this channel's videos, sorted newest first, from JST 2026-01-01+
  const sorted = videos
    .filter((v) => v.channelId === channelId && new Date(v.publishedAt).getTime() >= STREAK_2026_START)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  if (sorted.length === 0) return 0;

  // Deduplicate: keep only one video per JST date
  const seen = new Set<string>();
  const deduped: YouTubeVideo[] = [];
  for (const v of sorted) {
    const jstDay = toJstDate(v.publishedAt);
    if (!seen.has(jstDay)) {
      seen.add(jstDay);
      deduped.push(v);
    }
  }

  if (deduped.length === 0) return 0;

  // Count consecutive videos where gap ≤ 48 hours
  const MAX_GAP_MS = 48 * 60 * 60 * 1000; // 48 hours — absorbs timezone shifts + 1-day gaps
  let streak = 1;
  for (let i = 0; i < deduped.length - 1; i++) {
    const currTime = new Date(deduped[i].publishedAt).getTime();
    const prevTime = new Date(deduped[i + 1].publishedAt).getTime();
    const gap = currTime - prevTime;
    if (gap <= MAX_GAP_MS) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculate streaks for all channels at once.
 * Returns a map of channelId → streak count.
 */
export function calculateAllStreaksFromVideos(
  videos: YouTubeVideo[],
  channels: Channel[]
): Record<string, number> {
  const streaks: Record<string, number> = {};
  for (const ch of channels) {
    streaks[ch.id] = calculateStreakFromVideos(videos, ch.id);
  }
  return streaks;
}
