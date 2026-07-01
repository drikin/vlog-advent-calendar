import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getSession } from "@/lib/auth/session";

const DETAILS_KEY = "rsvp:jul4:details";

function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

/**
 * GET /api/rsvp/details — return event details (auth + RSVP required)
 *
 * Only returns details if the user has an RSVP entry.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  // Check if user has an RSVP entry
  const redis = getRedis();
  let entries: any[] = [];
  if (redis) {
    try {
      const raw = await redis.get("rsvp:jul4");
      if (Array.isArray(raw)) entries = raw;
    } catch {}
  }

  const userEntry = entries.find((e: any) => e.did === session.did);
  if (!userEntry) {
    return NextResponse.json({ error: "参加登録が必要です" }, { status: 403 });
  }

  // Return details from Redis (or fallback to env)
  let details: Record<string, string> | null = null;
  if (redis) {
    try {
      const raw = await redis.get(DETAILS_KEY);
      if (raw && typeof raw === "object") details = raw as Record<string, string>;
    } catch {}
  }

  if (!details) {
    const envDetails = process.env.OFFMEET_DETAILS;
    if (envDetails) {
      try { details = JSON.parse(envDetails); } catch {}
    }
  }

  if (!details) {
    return NextResponse.json({ error: "詳細情報が設定されていません" }, { status: 404 });
  }

  return NextResponse.json({ details });
}
