import { Redis } from "@upstash/redis";
import type { Channel } from "@/config/channels";
import { MONTHS } from "./months";

const KEY_PREFIX = "members:";

function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

/**
 * Default member list — used as fallback when Redis is unavailable.
 */
export const DEFAULT_CHANNELS: Channel[] = [
  { id: "UCTfta7Ult6yLu7ru-WInOGg", handle: "@koh",              name: "散財小説ドリキン",             color: "#FF6B6B", avatar: "https://yt3.ggpht.com/ytc/AIdro_kBtjK34x9MKJYa9wLJP49D2NIoe9KjUQiwtoXyqPJMrsxW=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCFuxphsWDDt210PEVWy883Q", handle: "@KentaYoutube",      name: "tamper's channel",               color: "#4ECDC4", avatar: "https://yt3.ggpht.com/FXTSZ2hOc7SnwDiyZ2ByvOpYBw_L2yqLswr6oESHUWtGxWRzbSUENuSfDI6vOn_2Shy54aJ_jw=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCJTvowm2dDsjw71aEHeHjGg", handle: "@散財ギタリストたなかしげつぐ", name: "散財ギタリストたなかしげつぐ", color: "#FFD93D", avatar: "https://yt3.ggpht.com/PSkg1UrPM0wUgqBHrsf-4wSEUOCtOO_8aHXx0ZZ-8ypvRGqEYUJC_88ryXepWamA06XEmr3F=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCC1iKYB1Y_KOtHZXk7zY1jg", handle: "@kentakov",          name: "きままにいっkov",               color: "#6C5CE7", avatar: "https://yt3.ggpht.com/zwiWX4CPOowPQFpVUAih3lTzxBuuFb86kvt5xj-TJZMVti1q5P8lIVup70Z9mqjyblhjzmpqR4Q=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCtECO9x5EpcH_E2UUN7QqdQ", handle: "@Cohtaro",           name: "こうたろうカメラ日記",          color: "#A8E6CF", avatar: "https://yt3.ggpht.com/bsfYhQoK0IzjIIPUngMhCNJ_P5FDG_CVX0iGWFo3kwCmZli65NPBoBisukONWKNq32gjhSweaHo=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCIcziIKVG1Y7meKEOXHNlGw", handle: "@eiko3kobe",         name: "EIKO⭐️",                        color: "#FF8A5C", avatar: "https://yt3.ggpht.com/jENe_xW3fFn7gYxVnxXhP8iBejmcscjMW9Ax-8exutOK9d5qXZAYqJEzU84pjMK_oAjgmVh0kA=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCn03CTDReLR6KfMYoHokVGw", handle: "@jun_ya",            name: "jun_ya vlog channel",            color: "#95E1D3", avatar: "https://yt3.ggpht.com/ytc/AIdro_mT-1gKUgBcgTXuqplkiVBTZH94ckf-D51f-whf4SRiQfg=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCWyzddWvD-GsV1wsLqSP_9A", handle: "@butsuyoku_life",    name: "物欲帳チャンネル",              color: "#F7B731", avatar: "https://yt3.ggpht.com/R87rmjvOt1R6wIaxO7xuxlmPWKqK2Ep4eeugsI9EM1MNIlRbECJl7K57PjAxN7Xqzw8TURXGOQ=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCIlZWUBUeHX-NGBhf2_9ixw", handle: "@JunOtomo",          name: "湘南Vlogger - Jun Otomo",       color: "#45B7D1", avatar: "https://yt3.ggpht.com/UsLjw3Lv-dld3anXsVRomvfWXo7cHpBNQ2x5JdttRBfbTjlpxcIr6C5NoDgjPNJT8Cn0i672=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UChjoF-1FQ1OprvUV-PoqHGQ", handle: "@mickel_xr",        name: "MICKEL",                         color: "#E17055", avatar: "https://yt3.ggpht.com/AuRIbSRU61mgFWpOQIrCu46bV3UxW1K-vR72hv-anEk_HQWCL0J--A_hZzWbk8acJIPq3mwRuvY=s800-c-k-c0x00ffffff-no-rj" },
];

/**
 * July 2026 member list — continuation members after the offline meetup.
 */
export const JULY_DEFAULT_CHANNELS: Channel[] = [
  { id: "UCTfta7Ult6yLu7ru-WInOGg", handle: "@koh",              name: "散財小説ドリキン",             color: "#FF6B6B", avatar: "https://yt3.ggpht.com/ytc/AIdro_kBtjK34x9MKJYa9wLJP49D2NIoe9KjUQiwtoXyqPJMrsxW=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCIcziIKVG1Y7meKEOXHNlGw", handle: "@eiko3kobe",         name: "EIKO⭐️",                        color: "#FF8A5C", avatar: "https://yt3.ggpht.com/jENe_xW3fFn7gYxVnxXhP8iBejmcscjMW9Ax-8exutOK9d5qXZAYqJEzU84pjMK_oAjgmVh0kA=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCJTvowm2dDsjw71aEHeHjGg", handle: "@散財ギタリストたなかしげつぐ", name: "散財ギタリストたなかしげつぐ", color: "#FFD93D", avatar: "https://yt3.ggpht.com/PSkg1UrPM0wUgqBHrsf-4wSEUOCtOO_8aHXx0ZZ-8ypvRGqEYUJC_88ryXepWamA06XEmr3F=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCC1iKYB1Y_KOtHZXk7zY1jg", handle: "@kentakov",          name: "きままにいっkov",               color: "#6C5CE7", avatar: "https://yt3.ggpht.com/zwiWX4CPOowPQFpVUAih3lTzxBuuFb86kvt5xj-TJZMVti1q5P8lIVup70Z9mqjyblhjzmpqR4Q=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCtECO9x5EpcH_E2UUN7QqdQ", handle: "@Cohtaro",           name: "こうたろうカメラ日記",          color: "#A8E6CF", avatar: "https://yt3.ggpht.com/bsfYhQoK0IzjIIPUngMhCNJ_P5FDG_CVX0iGWFo3kwCmZli65NPBoBisukONWKNq32gjhSweaHo=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UChjoF-1FQ1OprvUV-PoqHGQ", handle: "@mickel_xr",        name: "MICKEL",                         color: "#E17055", avatar: "https://yt3.ggpht.com/AuRIbSRU61mgFWpOQIrCu46bV3UxW1K-vR72hv-anEk_HQWCL0J--A_hZzWbk8acJIPq3mwRuvY=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCeHyXFWymAvAHZiW8sNFSPw", handle: "@watarunishida2nd791", name: "Wataru Nishida 西田航 2nd",    color: "#74B9FF", avatar: "https://yt3.ggpht.com/ytc/AIdro_lVZiZmTqiPxVEkRKsCLMAjHe1hBD8QEmS3dK9pQ3ZXWg=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCIlZWUBUeHX-NGBhf2_9ixw", handle: "@JunOtomo",          name: "湘南Vlogger - Jun Otomo",       color: "#45B7D1", avatar: "https://yt3.ggpht.com/UsLjw3Lv-dld3anXsVRomvfWXo7cHpBNQ2x5JdttRBfbTjlpxcIr6C5NoDgjPNJT8Cn0i672=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCWyzddWvD-GsV1wsLqSP_9A", handle: "@butsuyoku_life",    name: "物欲帳チャンネル",              color: "#F7B731", avatar: "https://yt3.ggpht.com/R87rmjvOt1R6wIaxO7xuxlmPWKqK2Ep4eeugsI9EM1MNIlRbECJl7K57PjAxN7Xqzw8TURXGOQ=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCImyTdQc9D3sO_fewFo5_qg", handle: "@dmp2205",          name: "だめぽ",                        color: "#FD79A8", avatar: "https://yt3.ggpht.com/ytc/AIdro_kWJbUJ5p8Wy1dLuTEUMzJLWPMOV_evRfXKGZtDeuO6JSt3BWQXRWDU0qpEoOChyboFO9W0=s800-c-k-c0x00ffffff-no-rj" },
  { id: "UCFuxphsWDDt210PEVWy883Q", handle: "@KentaYoutube",      name: "tamper's channel",             color: "#4ECDC4", avatar: "https://yt3.ggpht.com/FXTSZ2hOc7SnwDiyZ2ByvOpYBw_L2yqLswr6oESHUWtGxWRzbSUENuSfDI6vOn_2Shy54aJ_jw=s800-c-k-c0x00ffffff-no-rj" },
];

/** Get member list for a given month (format: "2026-06").
 *  Redis に保存されたリストを優先し、未設定ならデフォルトを返す。
 *  7月は JULY_DEFAULT_CHANNELS を使う（継続メンバー）。 */
export async function getMembers(month: string): Promise<Channel[]> {
  const redis = getRedis();
  const defaults = month === "2026-07" ? JULY_DEFAULT_CHANNELS : DEFAULT_CHANNELS;
  if (!redis) return defaults;

  try {
    const raw = await redis.get(`${KEY_PREFIX}${month}`);
    if (raw && Array.isArray(raw) && raw.length > 0) return raw as Channel[];
  } catch {
    // fall through
  }

  // Auto-seed: if key doesn't exist, save defaults and return them
  try {
    await redis.set(`${KEY_PREFIX}${month}`, JSON.stringify(defaults));
  } catch {
    // non-fatal
  }
  return defaults;
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
  const existing = await redis.get(`${KEY_PREFIX}${month}`);
  if (existing && Array.isArray(existing) && existing.length > 0) {
    return existing as Channel[];
  }

  // Copy from source month or use defaults (first supported month)
  let source: Channel[] = DEFAULT_CHANNELS;
  if (sourceMonth) {
    const src = await redis.get(`${KEY_PREFIX}${sourceMonth}`);
    if (src && Array.isArray(src) && src.length > 0) {
      source = src as Channel[];
    }
  } else {
    // Default to the first month's list
    const src = await redis.get(`${KEY_PREFIX}${MONTHS[0]}`);
    if (src && Array.isArray(src) && src.length > 0) {
      source = src as Channel[];
    }
  }

  await redis.set(`${KEY_PREFIX}${month}`, JSON.stringify(source));
  return source;
}
