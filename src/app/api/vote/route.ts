import { type NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getSession } from "@/lib/auth/session";

const KV_KEY = "vote:channels";

function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN)
    return null;
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

/**
 * GET /api/vote — return all votes (no auth required)
 *   { votes: { channelId: string; voters: string[] }[] }
 */
export async function GET() {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ votes: [] });

  try {
    const raw = await redis.get(KV_KEY);
    const votes: Record<string, string[]> =
      raw && typeof raw === "object" ? (raw as Record<string, string[]>) : {};
    return NextResponse.json({ votes });
  } catch {
    return NextResponse.json({ votes: {} });
  }
}

/** 
 * POST /api/vote — toggle vote for a channel (auth required)
 *
 * Body: { channelId: string }
 *
 * One user = max 3 votes total across all channels.
 * If user already voted for this channel, remove the vote (freeing a slot).
 * If user hasn't voted and has < 3 votes, add the vote.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "ログインが必要です" },
      { status: 401 }
    );
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "ストレージが利用できません" },
      { status: 500 }
    );
  }

  try {
    const body: { channelId?: string } = await request.json();
    const channelId = body.channelId?.trim();
    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 }
      );
    }

    const raw = await redis.get(KV_KEY);
    const votes: Record<string, string[]> =
      raw && typeof raw === "object" ? (raw as Record<string, string[]>) : {};

    if (!votes[channelId]) votes[channelId] = [];

    const did = session.did;
    const idx = votes[channelId].indexOf(did);

    if (idx >= 0) {
      // Remove vote (freeing a slot)
      votes[channelId].splice(idx, 1);
      if (votes[channelId].length === 0) delete votes[channelId];
    } else {
      // Count total votes for this user across all channels
      const totalVotes = Object.values(votes).filter((voters) => voters.includes(did)).length;
      if (totalVotes >= 3) {
        return NextResponse.json(
          { error: "投票は最大3つまでです", votes },
          { status: 400 }
        );
      }
      // Add vote
      votes[channelId].push(did);
    }

    await redis.set(KV_KEY, votes);

    return NextResponse.json({ votes });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}