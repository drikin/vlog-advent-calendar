import { CHANNELS } from "@/config/channels";
import { fetchAllVideos, groupByDate, type DayVideos } from "@/lib/youtube";
import VlogCalendarClient from "./VlogCalendarClient";
import { getSession } from "@/lib/auth/session";
import { resolveProfile } from "@/lib/auth/did-resolver";
import { getAllVotes } from "@/lib/vote";

// Dynamic rendering so cookie-based auth works on every request
export const dynamic = "force-dynamic";

/** Server Component: fetch YouTube data + auth state at request time */
export default async function Home() {
  let days: DayVideos[] = [];
  let error: string | null = null;

  try {
    const videos = await fetchAllVideos(CHANNELS);
    days = groupByDate(videos);
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
    votes = await getAllVotes();
  } catch {
    // ignore
  }

  return (
    <VlogCalendarClient
      days={days}
      error={error}
      channels={CHANNELS}
      updatedAt={new Date().toISOString()}
      userDid={userDid}
      userHandle={userHandle}
      userDisplayName={userDisplayName}
      votes={votes}
    />
  );
}