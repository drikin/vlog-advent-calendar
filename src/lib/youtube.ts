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

/** Fetch multiple channels and group by date */
export async function fetchAllVideos(
  channels: { id: string; handle: string; name: string }[]
): Promise<YouTubeVideo[]> {
  const allVideos: YouTubeVideo[] = [];

  for (const ch of channels) {
    const items = await fetchChannelVideos(ch.id);
    for (const item of items) {
      const publishedAt = item.snippet.publishedAt;
      const videoId = item.snippet.resourceId?.videoId;
      if (!videoId) continue;

      allVideos.push({
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
  }

  // Filter out live streams
  const allIds = allVideos.map((v) => v.videoId);
  const nonLiveIds = await filterLiveVideos(allIds);
  const filtered = allVideos.filter((v) => nonLiveIds.has(v.videoId));

  // Sort by publishedAt ascending
  filtered.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  return filtered;
}

/** Group videos by date (UTC date, June 2026 only) */
export function groupByDate(videos: YouTubeVideo[]): DayVideos[] {
  const map = new Map<string, YouTubeVideo[]>();
  for (const v of videos) {
    // Use UTC date from publishedAt ISO string directly
    const date = v.publishedAt.slice(0, 10); // "2026-06-02"
    // June 2026 only
    if (!date.startsWith("2026-06")) continue;
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(v);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, videos]) => ({ date, videos }));
}
