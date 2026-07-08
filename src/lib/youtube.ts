export interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  channelId: string;
  channelName: string;
  channelHandle: string;
}

export interface DayVideos {
  date: string; // "2026-06-01"
  videos: YouTubeVideo[];
}

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";
const API_KEY = process.env.YOUTUBE_API_KEY!;

/**
 * Fetch June 2026 videos via PlaylistItems API (uploads playlist).
 * Cost: 1 quota unit per call (vs 100 for Search API).
 * Uploads playlist ID = channel ID with "UC" replaced by "UU".
 */
async function fetchChannelVideos(channelId: string): Promise<any[]> {
  const uploadsPlaylistId = channelId.replace(/^UC/, "UU");
  const url = `${YT_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${API_KEY}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API error for ${channelId}: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.items || [];
}

/**
 * Fetch channel videos with pagination for streak calculation.
 * Keeps fetching pages until we've reached back to JST 2026-01-01
 * or the maximum page limit is reached.
 */
async function fetchChannelVideosForStreak(
  channelId: string,
  maxPages: number = 10
): Promise<any[]> {
  const uploadsPlaylistId = channelId.replace(/^UC/, "UU");
  // JST 2026-01-01T00:00:00 = UTC 2025-12-31T15:00:00
  const CUTOFF_MS = new Date("2025-12-31T15:00:00Z").getTime();
  let allItems: any[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
      key: API_KEY,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `${YT_API_BASE}/playlistItems?${params}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) break;

    const data = await res.json();
    allItems = allItems.concat(data.items || []);
    pageToken = data.nextPageToken;

    if (!pageToken) break; // No more pages

    // Stop early if we've reached back to JST 2026-01-01 cutoff
    const oldestInPage = data.items?.[data.items.length - 1]?.snippet?.publishedAt;
    if (oldestInPage && new Date(oldestInPage).getTime() < CUTOFF_MS) break;
  }

  return allItems;
}

/**
 * Fetch streak data for all channels — paginated to find streak breaks.
 * Returns videos grouped by date, suitable for streak calculation.
 */
export async function fetchAllStreakData(
  channels: { id: string; handle: string; name: string }[]
): Promise<YouTubeVideo[]> {
  const allVideos: YouTubeVideo[] = [];

  const results = await Promise.allSettled(
    channels.map(async (ch) => {
      const items = await fetchChannelVideosForStreak(ch.id);
      const videos: YouTubeVideo[] = [];
      for (const item of items) {
        const videoId = item.snippet?.resourceId?.videoId;
        if (!videoId) continue;
        videos.push({
          videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || "",
          publishedAt: item.snippet.publishedAt,
          channelId: ch.id,
          channelName: ch.name,
          channelHandle: ch.handle,
        });
      }
      return videos;
    })
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      allVideos.push(...result.value);
    }
  }

  // Sort by publishedAt ascending
  allVideos.sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );
  return allVideos;
}

/**
 * Batch-check video IDs to filter out live streams.
 * Returns a Set of videoIds that are NOT live streams.
 * Cost: 1 quota unit per 50 videos.
 */
async function filterLiveVideos(videoIds: string[]): Promise<Set<string>> {
  const nonLive = new Set<string>();
  // batch in chunks of 50
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50).join(",");
    const url = `${YT_API_BASE}/videos?part=snippet,liveStreamingDetails&id=${chunk}&key=${API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) continue;
    const data = await res.json();
    for (const item of data.items || []) {
      // liveStreamingDetails exists → was a live stream → exclude
      if (!item.liveStreamingDetails) {
        nonLive.add(item.id);
      }
    }
  }
  return nonLive;
}

/** Fetch multiple channels in parallel and group by date */
export async function fetchAllVideos(
  channels: { id: string; handle: string; name: string }[]
): Promise<YouTubeVideo[]> {
  const allVideos: YouTubeVideo[] = [];

  // Parallel fetch with allSettled — one channel dying doesn't kill the rest
  const results = await Promise.allSettled(
    channels.map(async (ch) => {
      const items = await fetchChannelVideos(ch.id);
      const videos: YouTubeVideo[] = [];
      for (const item of items) {
        const publishedAt = item.snippet.publishedAt;
        const videoId = item.snippet.resourceId?.videoId;
        if (!videoId) continue;

        videos.push({
          videoId,
          title: item.snippet.title,
          thumbnail:
            item.snippet.thumbnails?.high?.url ||
            item.snippet.thumbnails?.medium?.url ||
            "",
          publishedAt,
          channelId: ch.id,
          channelName: ch.name,
          channelHandle: ch.handle,
        });
      }
      return videos;
    })
  );

  // Collect successes, log failures
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      allVideos.push(...result.value);
    } else {
      const ch = channels[i];
      console.warn(`[YouTube] Failed to fetch channel ${ch.handle} (${ch.id}): ${result.reason}`);
      // Channel fails silently — other channels still work
    }
  }

  // Filter out live streams
  const allIds = allVideos.map((v) => v.videoId);
  const nonLiveIds = await filterLiveVideos(allIds);
  const filtered = allVideos.filter((v) => nonLiveIds.has(v.videoId));

  // Sort by publishedAt ascending
  filtered.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  return filtered;
}

/** Fetch all videos with fallback: return stale cache on total failure */
export async function fetchAllVideosWithFallback(
  channels: { id: string; handle: string; name: string }[],
  fallback: YouTubeVideo[] = []
): Promise<{ videos: YouTubeVideo[]; partialFailure: boolean }> {
  try {
    const videos = await fetchAllVideos(channels);
    return { videos, partialFailure: false };
  } catch (error) {
    console.error("[YouTube] Total fetch failure, returning fallback:", error);
    return { videos: fallback, partialFailure: true };
  }
}

/** Group videos by date for a given month.
 *  Date is computed in JST (Asia/Tokyo) so videos published early
 *  morning JST (which fall on the previous UTC day) land on the
 *  correct calendar day. */
export function groupByDate(videos: YouTubeVideo[], monthPrefix: string = "2026-06"): DayVideos[] {
  const map = new Map<string, YouTubeVideo[]>();
  for (const v of videos) {
    const date = toJstDate(v.publishedAt);
    if (!date.startsWith(monthPrefix)) continue;
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(v);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, videos]) => ({ date, videos }));
}

/** Convert a UTC ISO timestamp to JST date string (YYYY-MM-DD). */
function toJstDate(publishedAt: string): string {
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(publishedAt));
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}
