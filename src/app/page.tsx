import { fetchAllVideos, groupByDate, type DayVideos } from "@/lib/youtube";
import { getMembers } from "@/lib/members";
import VlogCalendarClient from "./VlogCalendarClientDynamic";
import { getSession } from "@/lib/auth/session";
import { resolveProfile } from "@/lib/auth/did-resolver";
import { getAllVotes } from "@/lib/vote";
import { getStreaks } from "@/lib/streak-cache";
import { getAllStamps } from "@/lib/stamps";

// Dynamic rendering so cookie-based auth works on every request
export const dynamic = "force-dynamic";

/** Server Component: fetch YouTube data + auth state at request time */
export default async function Home() {
  let juneDays: DayVideos[] = [];
  let julyDays: DayVideos[] = [];
  let error: string | null = null;

  // Fetch member lists from Redis (fallback to defaults)
  const juneChannels = await getMembers("2026-06");
  const julyChannels = await getMembers("2026-07");

  try {
    // Fetch all videos once using the unified channel list
    const allUniqueChannels = [...juneChannels, ...julyChannels].filter(
      (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
    );
    const allVideos = await fetchAllVideos(allUniqueChannels);
    juneDays = groupByDate(allVideos, "2026-06");
    julyDays = groupByDate(allVideos, "2026-07");
  } catch (e) {
    error = String(e);
  }

  // Get auth state via SSR
  let userDid: string | null = null;
  let userHandle: string | null = null;
  let userDisplayName: string | null = null;
  let userAvatar: string | null = null;
  try {
    const session = await getSession();
    if (session) {
      userDid = session.did;
      const profile = await resolveProfile(session.did);
      if (profile) {
        userHandle = profile.handle;
        userDisplayName = profile.displayName;
        userAvatar = profile.avatar ?? null;
      }
    }
  } catch {
    // Not authenticated — fine
  }

  // Fetch votes for July channels
  let votes: Record<string, string[]> = {};
  try {
    votes = await getAllVotes(julyChannels, "2026-07");
  } catch {
    // ignore
  }

  // Fetch streak data (cached in Redis, refreshes every 6h)
  let streaks: Record<string, number> = {};
  try {
    const allUniqueChannels = [...juneChannels, ...julyChannels].filter(
      (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
    );
    streaks = await getStreaks(allUniqueChannels);
  } catch {
    // non-fatal
  }

  // Fetch stamp data (daily, for current month)
  let stamps: Record<string, Record<string, number>> = {};
  try {
    stamps = await getAllStamps(julyChannels);
  } catch {
    // non-fatal
  }

  return (
    <VlogCalendarClient
      juneDays={juneDays}
      julyDays={julyDays}
      error={error}
      channels={juneChannels}
      channelsJuly={julyChannels}
      updatedAt={new Date().toISOString()}
      userDid={userDid}
      userHandle={userHandle}
      userDisplayName={userDisplayName}
      userAvatar={userAvatar}
      votes={votes}
      streaks={streaks}
      stamps={stamps}
    />
  );
}
