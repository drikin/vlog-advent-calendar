import { Redis } from "@upstash/redis";
import { fetchAllStreakData, type YouTubeVideo } from "./youtube";
import type { Channel } from "@/config/channels";
import { calculateAllStreaksFromVideos } from "./streak";

const CACHE_KEY = "streak:computed:v15"; // v15: unified channel list June+July
const CACHE_TTL = 60 * 60 * 24; // 24 hours

function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

/**
 * Get cached streak data, or compute and cache if stale/missing.
 * Returns a map of channelId → streak count.
 *
 * Uses time-based gap detection (36h threshold) instead of calendar dates,
 * so timezone shifts during travel don't break streaks.
 */
export async function getStreaks(
  channels: Channel[]
): Promise<Record<string, number>> {
  const redis = getRedis();

  // Try cache first
  if (redis) {
    try {
      const cached = await redis.get<{ data: Record<string, number>; updatedAt: string }>(CACHE_KEY);
      if (cached && cached.data) {
        return cached.data;
      }
    } catch {
      // cache miss — fall through
    }
  }

  // Cache miss — fetch from YouTube API
  const streakVideos = await fetchAllStreakData(channels);

  // Calculate streaks using time-based gap detection
  const streaks = calculateAllStreaksFromVideos(streakVideos, channels);

  // Cache in Redis
  if (redis) {
    try {
      await redis.set(CACHE_KEY, { data: streaks, updatedAt: new Date().toISOString() }, { ex: CACHE_TTL });
    } catch {
      // non-fatal
    }
  }

  return streaks;
}
