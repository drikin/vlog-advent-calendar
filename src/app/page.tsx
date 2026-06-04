import { CHANNELS } from "@/config/channels";
import { fetchAllVideos, groupByDate, type YouTubeVideo, type DayVideos } from "@/lib/youtube";
import VlogCalendarClient from "./VlogCalendarClient";

// ISR: revalidate every hour
export const revalidate = 3600;

/** Server Component: fetch YouTube data at build/revalidate time */
export default async function Home() {
  let days: DayVideos[] = [];
  let error: string | null = null;
  let partialFailure = false;

  try {
    const videos = await fetchAllVideos(CHANNELS);
    days = groupByDate(videos);
  } catch (e) {
    error = String(e);
  }

  return (
    <VlogCalendarClient
      days={days}
      error={error}
      channels={CHANNELS}
      updatedAt={new Date().toISOString()}
    />
  );
}
