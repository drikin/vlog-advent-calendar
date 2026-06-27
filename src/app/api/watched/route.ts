import { type NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getSession } from "@/lib/auth/session";

const KV_PREFIX = "watched:";

function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

export interface WatchedEntry {
  videoId: string;
  watchedAt: string; // ISO timestamp
}

/**
 * GET /api/watched — return all watched entries for the authenticated user
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ entries: [] });
  }

  try {
    const raw = await redis.get(KV_PREFIX + session.did);
    const entries: WatchedEntry[] = Array.isArray(raw) ? raw : [];
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}

/**
 * POST /api/watched — add watched entries (idempotent).
 *
 * Body can be:
 *   { videoId: string }                    — single entry
 *   { entries: { videoId: string }[] }     — batch entries (for migration)
 *
 * When entries is provided, each entry's watchedAt is set to now.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "ストレージが利用できません" }, { status: 500 });
  }

  try {
    const body: { videoId?: string; entries?: { videoId: string }[] } = await request.json();
    const key = KV_PREFIX + session.did;

    // Load existing entries
    const raw = await redis.get(key);
    const existing: WatchedEntry[] = Array.isArray(raw) ? raw : [];
    const existingIds = new Set(existing.map((e) => e.videoId));

    // Determine which videoIds to add
    let newIds: string[];
    if (body.entries && Array.isArray(body.entries)) {
      // Batch mode — for migration from localStorage
      newIds = body.entries.map((e) => e.videoId?.trim()).filter(Boolean);
    } else if (body.videoId?.trim()) {
      newIds = [body.videoId.trim()];
    } else {
      return NextResponse.json({ error: "videoId or entries is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    let changed = false;

    for (const videoId of newIds) {
      if (!existingIds.has(videoId)) {
        existing.push({ videoId, watchedAt: now });
        existingIds.add(videoId);
        changed = true;
      }
    }

    if (changed) {
      await redis.set(key, existing);
    }

    return NextResponse.json({ entries: existing });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
