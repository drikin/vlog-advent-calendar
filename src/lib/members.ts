import { Redis } from "@upstash/redis";
import type { Channel } from "@/config/channels";

const KEY_PREFIX = "members:";

function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

/**
 * Default member list — used as fallback when Redis is unavailable.
 */
export const DEFAULT_CHANNELS: Channel[] = [
  { id: "UCTfta7Ult6yLu7ru-WInOGg", handle: "@koh",              name: "散財小説ドリキン",             color: "#FF6B6B" },
  { id: "UCFuxphsWDDt210PEVWy883Q", handle: "@KentaYoutube",      name: "tamper's channel",               color: "#4ECDC4" },
  { id: "UCJTvowm2dDsjw71aEHeHjGg", handle: "@散財ギタリストたなかしげつぐ", name: "散財ギタリストたなかしげつぐ", color: "#FFD93D" },
  { id: "UCC1iKYB1Y_KOtHZXk7zY1jg", handle: "@kentakov",          name: "きままにいっkov",               color: "#6C5CE7" },
  { id: "UCtECO9x5EpcH_E2UUN7QqdQ", handle: "@Cohtaro",           name: "こうたろうカメラ日記",          color: "#A8E6CF" },
  { id: "UCIcziIKVG1Y7meKEOXHNlGw", handle: "@eiko3kobe",         name: "EIKO⭐️",                        color: "#FF8A5C" },
  { id: "UCn03CTDReLR6KfMYoHokVGw", handle: "@jun_ya",            name: "jun_ya vlog channel",            color: "#95E1D3" },
  { id: "UCWyzddWvD-GsV1wsLqSP_9A", handle: "@butsuyoku_life",    name: "物欲帳チャンネル",              color: "#F7B731" },
  { id: "UCIlZWUBUeHX-NGBhf2_9ixw", handle: "@JunOtomo",          name: "湘南Vlogger - Jun Otomo",       color: "#45B7D1" },
  { id: "UChjoF-1FQ1OprvUV-PoqHGQ", handle: "@mickel_xr",        name: "MICKEL",                         color: "#E17055" },
];

/** Get member list for a given month (format: "2026-06") */
export async function getMembers(month: string): Promise<Channel[]> {
  const redis = getRedis();
  if (!redis) return DEFAULT_CHANNELS;

  try {
    const raw = await redis.get(`${KEY_PREFIX}${month}`);
    if (raw && Array.isArray(raw)) return raw as Channel[];
  } catch {
    // fall through
  }

  // Auto-seed: if key doesn't exist, save defaults and return them
  try {
    await redis.set(`${KEY_PREFIX}${month}`, JSON.stringify(DEFAULT_CHANNELS));
  } catch {
    // non-fatal
  }
  return DEFAULT_CHANNELS;
}

/** Save member list for a given month */
export async function setMembers(month: string, channels: Channel[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  await redis.set(`${KEY_PREFIX}${month}`, JSON.stringify(channels));
}

/** Initialize members for a month by copying from another month or defaults */
export async function initMembers(month: string, sourceMonth?: string): Promise<Channel[]> {
  const redis = getRedis();
  if (!redis) return DEFAULT_CHANNELS;

  // Check if already exists
  const existing = await redis.get(`${KEY_PREFIX}${month}`);
  if (existing && Array.isArray(existing) && existing.length > 0) {
    return existing as Channel[];
  }

  // Copy from source month or use defaults
  let source: Channel[] = DEFAULT_CHANNELS;
  if (sourceMonth) {
    const src = await redis.get(`${KEY_PREFIX}${sourceMonth}`);
    if (src && Array.isArray(src) && src.length > 0) {
      source = src as Channel[];
    }
  }

  await redis.set(`${KEY_PREFIX}${month}`, JSON.stringify(source));
  return source;
}
