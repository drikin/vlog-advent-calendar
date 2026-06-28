import { CHANNELS } from "@/config/channels";
import { fetchAllVideos, groupByDate, type DayVideos } from "@/lib/youtube";
import VlogCalendarClient from "./VlogCalendarClient";
import { getSession } from "@/lib/auth/session";
import { resolveProfile } from "@/lib/auth/did-resolver";
import { Redis } from "@upstash/redis";

// Dynamic rendering so cookie-based auth works on every request
export const dynamic = "force-dynamic";

const KV_VOTE_KEY = "vote:channels";

function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN)
    return null;
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

async function fetchVotes(): Promise<Record<string, string[]>> {
  const redis = getRedis();
  if (!redis) return {};
  try {
    const raw = await redis.get(KV_VOTE_KEY);
    return raw && typeof raw === "object" ? (raw as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

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
    votes = await fetchVotes();
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