import { CHANNELS } from "@/config/channels";
import { YouTubeVideo, DayVideos, fetchAllVideos, groupByDate } from "@/lib/youtube";

export interface SiteData {
  updatedAt: string;
  days: DayVideos[];
}

export async function buildSiteData(): Promise<SiteData> {
  const videos = await fetchAllVideos(CHANNELS);
  const days = groupByDate(videos);
  return {
    updatedAt: new Date().toISOString(),
    days,
  };
}
