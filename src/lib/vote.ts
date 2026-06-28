import { Redis } from "@upstash/redis";
import { CHANNELS } from "@/config/channels";

function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN)
    return null;
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

/**
 * Vote storage uses Redis SETs for atomic operations:
 *   vote:ch:{channelId} → SET of voter DIDs (who voted for this channel)
 *   vote:user:{did}     → SET of channelIds (what this user voted for)
 *
 * This eliminates the read-modify-write race condition that existed
 * when all votes were stored in a single JSON blob.
 */

export function chKey(channelId: string): string {
  return `vote:ch:${channelId}`;
}

export function userKey(did: string): string {
  return `vote:user:${did}`;
}

export const MAX_VOTES = 3;

let _migrated = false;

/**
 * One-time migration: move votes from old single JSON key to Redis SETs.
 *
 * Old format:  vote:channels = { channelId: [did, did, ...], ... }
 * New format:  vote:ch:{channelId} = SET(did, did, ...)
 *              vote:user:{did}     = SET(channelId, channelId, ...)
 *
 * Safe to call multiple times — checks a flag and bails early.
 */
async function migrateOldVotes(redis: Redis): Promise<void> {
  if (_migrated) return;
  _migrated = true;

  try {
    const raw = await redis.get("vote:channels");
    if (!raw || typeof raw !== "object") return;

    const oldVotes = raw as Record<string, string[]>;
    const pipeline = redis.pipeline();

    for (const [channelId, dids] of Object.entries(oldVotes)) {
      if (!Array.isArray(dids) || dids.length === 0) continue;
      // Use individual sadd calls to avoid TS spread issues
      for (const did of dids) {
        pipeline.sadd(chKey(channelId), did);
        pipeline.sadd(userKey(did), channelId);
      }
    }

    await pipeline.exec();
    // Delete the old key so migration doesn't run again
    await redis.del("vote:channels");
    console.log(`[vote] Migrated ${Object.keys(oldVotes).length} channels from old format`);
  } catch {
    // Non-fatal — old data might not exist
  }
}

/**
 * Read all channel votes in a single pipeline (efficient, atomic reads).
 */
export async function getAllVotes(): Promise<Record<string, string[]>> {
  const redis = getRedis();
  if (!redis) return {};

  try {
    await migrateOldVotes(redis);

    const pipeline = redis.pipeline();
    for (const ch of CHANNELS) {
      pipeline.smembers(chKey(ch.id));
    }
    const results = await pipeline.exec();

    const votes: Record<string, string[]> = {};
    for (let i = 0; i < CHANNELS.length; i++) {
      const members = results[i] as string[];
      if (members && members.length > 0) {
        votes[CHANNELS[i].id] = members;
      }
    }
    return votes;
  } catch {
    return {};
  }
}

/**
 * Toggle a user's vote for a channel (atomic).
 * Returns { votes, error? }
 */
export async function toggleVote(
  did: string,
  channelId: string
): Promise<{ votes: Record<string, string[]>; error?: string; status?: number }> {
  const redis = getRedis();
  if (!redis) {
    return { votes: {}, error: "ストレージが利用できません", status: 500 };
  }

  try {
    // Check if already voted (atomic)
    const alreadyVoted = await redis.sismember(chKey(channelId), did);

    if (alreadyVoted) {
      // Remove vote — atomic SREM on both keys
      await redis.srem(chKey(channelId), did);
      await redis.srem(userKey(did), channelId);
    } else {
      // Check total votes for this user (atomic SCARD)
      const totalVotes = await redis.scard(userKey(did));
      if (totalVotes >= MAX_VOTES) {
        const votes = await getAllVotes();
        return {
          votes,
          error: "投票は最大3つまでです",
          status: 400,
        };
      }
      // Add vote — atomic SADD on both keys
      await redis.sadd(chKey(channelId), did);
      await redis.sadd(userKey(did), channelId);
    }

    const votes = await getAllVotes();
    return { votes };
  } catch (e) {
    return { votes: {}, error: String(e), status: 500 };
  }
}
