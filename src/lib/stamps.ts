import { Redis } from "@upstash/redis";

const STAMP_KEY = "stamps";
const STAMP_TYPES = ["👍", "🔥", "🎉", "❤️"] as const;
export type StampType = (typeof STAMP_TYPES)[number];

function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

/** Get today's date string in JST (Intl でタイムゾーン明示) */
function todayJst(): string {
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** Get stamp counts for a list of video IDs */
export async function getStampsForVideos(
  videoIds: string[]
): Promise<Record<string, Record<StampType, number>>> {
  const redis = getRedis();
  if (!redis) return {};

  const pipeline = redis.pipeline();
  for (const vid of videoIds) {
    pipeline.hgetall(`${STAMP_KEY}:video:${vid}`);
  }
  const results = await pipeline.exec();

  const stamps: Record<string, Record<StampType, number>> = {};
  for (let i = 0; i < videoIds.length; i++) {
    const data = results[i] as Record<string, string> | null;
    stamps[videoIds[i]] = {
      "👍": parseInt(data?.["👍"] || "0"),
      "🔥": parseInt(data?.["🔥"] || "0"),
      "🎉": parseInt(data?.["🎉"] || "0"),
      "❤️": parseInt(data?.["❤️"] || "0"),
    };
  }
  return stamps;
}

/**
 * Toggle a stamp for a video by IP.
 * Uses daily voter tracking (resets each day) with cumulative counts per video.
 */
export async function toggleStamp(
  videoId: string,
  ip: string,
  stamp: StampType
): Promise<{ counts: Record<StampType, number>; action: "added" | "removed" } | null> {
  const redis = getRedis();
  if (!redis) return null;

  const today = todayJst();

  // Daily voter tracking per video: stamps:voters:{date}:{videoId}:{stamp} → Set of IPs
  const voterKey = `${STAMP_KEY}:voters:${today}:${videoId}:${stamp}`;
  const alreadyStamped = await redis.sismember(voterKey, ip);

  // Cumulative count: stamps:video:{videoId} → hash of emoji→count
  const countKey = `${STAMP_KEY}:video:${videoId}`;

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
