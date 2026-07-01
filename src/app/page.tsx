import { fetchAllVideos, groupByDate, type DayVideos } from "@/lib/youtube";
import { getMembers } from "@/lib/members";
import VlogCalendarClient from "./VlogCalendarClient";
import { getSession } from "@/lib/auth/session";
import { resolveProfile } from "@/lib/auth/did-resolver";
import { getAllVotes } from "@/lib/vote";

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

  // All unique channels across both months
  const allChannels = [...juneChannels, ...julyChannels].filter(
    (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
  );

  try {
    // Fetch videos for all unique channels across both months
    const videos = await fetchAllVideos(allChannels);
    juneDays = groupByDate(videos, "2026-06");
    julyDays = groupByDate(videos, "2026-07");
  } catch (e) {
    error = String(e);
  }

  // Get auth state via SSR
  let userDid: string | null = null;
  let userHandle: string | null = null;
  let userDisplayName: string | null = null;
  try {
    const session = await getSession();
    if (session) {
      userDid = session.did;
      const profile = await resolveProfile(session.did);
      if (profile) {
        userHandle = profile.handle;
        userDisplayName = profile.displayName;
      }
    }
  } catch {
    // Not authenticated — fine
  }

  // Fetch votes
  let votes: Record<string, string[]> = {};
  try {
    votes = await getAllVotes(allChannels);
  } catch {
    // ignore
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
      votes={votes}
    />
  );
}
