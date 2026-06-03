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

/** Fetch latest videos for a channel (max 5) */
async function fetchChannelVideos(channelId: string): Promise<any[]> {
  const url = `${YT_API_BASE}/search?part=snippet&channelId=${channelId}&order=date&maxResults=5&type=video&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API error for ${channelId}: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.items || [];
}

/** Fetch multiple channels and group by date */
export async function fetchAllVideos(
  channels: { id: string; handle: string; name: string }[]
): Promise<YouTubeVideo[]> {
  const allVideos: YouTubeVideo[] = [];

  for (const ch of channels) {
    const items = await fetchChannelVideos(ch.id);
    for (const item of items) {
      const publishedAt = item.snippet.publishedAt; // ISO 8601
      // Only keep June 2026 videos
      if (!publishedAt.startsWith("2026-06")) continue;

      allVideos.push({
        videoId: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || "",
        publishedAt,
        channelId: ch.id,
        channelName: ch.name,
        channelHandle: ch.handle,
      });
    }
  }

  // Sort by publishedAt ascending
  allVideos.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  return allVideos;
}

/** Group videos by date */
export function groupByDate(videos: YouTubeVideo[]): DayVideos[] {
  const map = new Map<string, YouTubeVideo[]>();
  for (const v of videos) {
    const date = v.publishedAt.split("T")[0]; // "2026-06-01"
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(v);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, videos]) => ({ date, videos }));
}
