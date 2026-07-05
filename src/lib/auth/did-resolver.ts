/**
 * Resolve human-readable profile info from a DID using the AT Protocol.
 *
 * DID → handle: plc.directory (DID document → alsoKnownAs)
 * handle → displayName: Bluesky API (app.bsky.actor.getProfile)
 *
 * Results are cached in Upstash Redis with 5-minute TTL to avoid
 * on every SSR request hitting plc.directory + Bluesky API (= 2 HTTP calls).
 */

import { Redis } from "@upstash/redis";

export interface DidProfile {
  handle: string;       // e.g. "koh.bsky.social"
  displayName: string;  // e.g. "ドリキン"
  avatar?: string;      // Avatar URL from Bluesky
}

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const CACHE_PREFIX = "profile:";
const CACHE_TTL = 300; // 5 minutes

export async function resolveProfile(did: string): Promise<DidProfile | null> {
  if (!did?.startsWith("did:")) return null;

  // 1. Try Redis cache first
  const cached = await getCached(did);
  if (cached) return cached;

  // 2. Resolve from upstream
  const handle = await resolveHandle(did);
  if (!handle) return null;

  const { displayName, avatar } = await resolveDisplayName(handle);
  const profile: DidProfile = { handle, displayName: displayName ?? handle, avatar: avatar ?? undefined };

  // 3. Cache in Redis (best-effort)
  await setCached(did, profile);

  return profile;
}

/* ─── Redis caching ─── */

async function getCached(did: string): Promise<DidProfile | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    const raw = await redis.get<string>(CACHE_PREFIX + did);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DidProfile;
    if (parsed?.handle) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function setCached(did: string, profile: DidProfile): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(CACHE_PREFIX + did, JSON.stringify(profile), { ex: CACHE_TTL });
  } catch {
    // cache miss is non-fatal
  }
}

/* ─── Upstream resolution ─── */

async function resolveHandle(did: string): Promise<string | null> {
  try {
    const res = await fetch(`https://plc.directory/${did}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const doc = (await res.json()) as { alsoKnownAs?: string[] };
    if (!doc.alsoKnownAs) return null;

    for (const uri of doc.alsoKnownAs) {
      if (uri.startsWith("at://")) {
        return uri.slice(5);
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveDisplayName(handle: string): Promise<{ displayName: string | null; avatar: string | null }> {
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { displayName: null, avatar: null };

    const data = (await res.json()) as { displayName?: string; avatar?: string };
    return {
      displayName: data.displayName ?? null,
      avatar: data.avatar ?? null,
    };
  } catch {
    return { displayName: null, avatar: null };
  }
}
