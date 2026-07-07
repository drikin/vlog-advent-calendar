import { Redis } from "@upstash/redis";

const STAMP_KEY = "stamps";
const STAMP_TYPES = ["👍", "🔥", "🎉", "❤️"] as const;
export type StampType = (typeof STAMP_TYPES)[number];

function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

/** Get today's date string in JST */
function todayJst(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/** Get monthly stamp counts for all channels */
export async function getAllStamps(
  channels: { id: string }[]
): Promise<Record<string, Record<StampType, number>>> {
  const redis = getRedis();
  if (!redis) return {};

  const pipeline = redis.pipeline();
  for (const ch of channels) {
    pipeline.hgetall(`${STAMP_KEY}:monthly:${ch.id}`);
  }
  const results = await pipeline.exec();

  const stamps: Record<string, Record<StampType, number>> = {};
  for (let i = 0; i < channels.length; i++) {
    const data = results[i] as Record<string, string> | null;
    stamps[channels[i].id] = {
      "👍": parseInt(data?.["👍"] || "0"),
      "🔥": parseInt(data?.["🔥"] || "0"),
      "🎉": parseInt(data?.["🎉"] || "0"),
      "❤️": parseInt(data?.["❤️"] || "0"),
    };
  }
  return stamps;
}

/**
 * Toggle a stamp for a channel by IP.
 * Uses daily voter tracking (resets each day) but monthly cumulative counts.
 */
export async function toggleStamp(
  channelId: string,
  ip: string,
  stamp: StampType
): Promise<{ counts: Record<StampType, number>; action: "added" | "removed" } | null> {
  const redis = getRedis();
  if (!redis) return null;

  const today = todayJst();

  // Daily voter tracking: stamps:voters:{date}:{channelId}:{stamp} → Set of IPs
  const voterKey = `${STAMP_KEY}:voters:${today}:${channelId}:${stamp}`;
  const alreadyStamped = await redis.sismember(voterKey, ip);

  // Monthly cumulative count: stamps:monthly:{channelId} → hash of emoji→count
  const countKey = `${STAMP_KEY}:monthly:${channelId}`;

  if (alreadyStamped) {
    // Remove stamp
    const pipeline = redis.pipeline();
    pipeline.srem(voterKey, ip);
    pipeline.hincrby(countKey, stamp, -1);
    await pipeline.exec();
  } else {
    // Add stamp
    const pipeline = redis.pipeline();
    pipeline.sadd(voterKey, ip);
    pipeline.expire(voterKey, 86400);
    pipeline.hincrby(countKey, stamp, 1);
    await pipeline.exec();
  }

  // Get updated counts
  const data = await redis.hgetall<Record<string, string>>(countKey);
  const counts = {
    "👍": parseInt(data?.["👍"] || "0"),
    "🔥": parseInt(data?.["🔥"] || "0"),
    "🎉": parseInt(data?.["🎉"] || "0"),
    "❤️": parseInt(data?.["❤️"] || "0"),
  };

  return { counts, action: alreadyStamped ? "removed" : "added" };
}
