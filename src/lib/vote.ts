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

/**
 * Read all channel votes in a single pipeline (efficient, atomic reads).
 */
export async function getAllVotes(): Promise<Record<string, string[]>> {
  const redis = getRedis();
  if (!redis) return {};

  try {
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
