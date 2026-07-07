import { Redis } from "@upstash/redis";

const VISIT_KEY = "visits:total";

function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

/** トップページの累計アクセス数をインクリメントして返す */
export async function incrAndGetVisits(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    return await redis.incr(VISIT_KEY);
  } catch {
    return 0;
  }
}
