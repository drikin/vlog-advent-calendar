import { fetchAllVideos, groupByDate, type DayVideos } from "@/lib/youtube";
import { getMembers } from "@/lib/members";
import VlogCalendarClient from "./VlogCalendarClientDynamic";
import { getSession } from "@/lib/auth/session";
import { resolveProfile } from "@/lib/auth/did-resolver";
import { getAllVotes } from "@/lib/vote";
import { getStreaks } from "@/lib/streak-cache";
import { getAllStamps } from "@/lib/stamps";
import { MONTHS, defaultMonth } from "@/lib/months";

// Dynamic rendering so cookie-based auth works on every request
export const dynamic = "force-dynamic";

/** Server Component: fetch YouTube data + auth state at request time */
export default async function Home() {
  let daysByMonth: Record<string, DayVideos[]> = {};
  let error: string | null = null;

  // Fetch member lists per month from Redis (fallback to defaults)
  const channelsByMonth: Record<string, Awaited<ReturnType<typeof getMembers>>> = {};
  for (const m of MONTHS) {
    channelsByMonth[m] = await getMembers(m);
  }

  // Unique channel list across all months for video fetching
  const allUniqueChannels = Object.values(channelsByMonth)
    .flat()
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);

  try {
    // Fetch all videos once using the unified channel list
    const allVideos = await fetchAllVideos(allUniqueChannels);
    for (const m of MONTHS) {
      daysByMonth[m] = groupByDate(allVideos, m);
    }
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

  // Fetch votes + stamps for the default (current) month
  const activeMonth = defaultMonth();
  const activeChannels = channelsByMonth[activeMonth] || allUniqueChannels;

  // Fetch votes for active month channels
  let votes: Record<string, string[]> = {};
  try {
    votes = await getAllVotes(activeChannels, activeMonth);
  } catch {
    // ignore
  }

  // Fetch streak data (cached in Redis, refreshes every 6h)
  let streaks: Record<string, number> = {};
  try {
    streaks = await getStreaks(allUniqueChannels);
  } catch {
    // non-fatal
  }

  // Fetch stamp data (daily, for current month)
  let stamps: Record<string, Record<string, number>> = {};
  try {
    stamps = await getAllStamps(activeChannels, activeMonth);
  } catch {
    // non-fatal
  }

  return (
    <VlogCalendarClient
      daysByMonth={daysByMonth}
      channelsByMonth={channelsByMonth}
      error={error}
      updatedAt={new Date().toISOString()}
      userDid={userDid}
      userHandle={userHandle}
      userDisplayName={userDisplayName}
      userAvatar={userAvatar}
      votes={votes}
      streaks={streaks}
      stamps={stamps}
      initialMonth={activeMonth}
    />
  );
}
