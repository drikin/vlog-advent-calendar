import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAllVotes, toggleVote } from "@/lib/vote";

/**
 * GET /api/vote — return all votes (no auth required)
 *   { votes: { channelId: string; voters: string[] }[] }
 */
export async function GET() {
  const votes = await getAllVotes();
  return NextResponse.json({ votes });
}

/**
 * POST /api/vote — toggle vote for a channel (auth required)
 *
 * Body: { channelId: string }
 *
 * One user = max 3 votes total across all channels.
 * If user already voted for this channel, remove the vote (freeing a slot).
 * If user hasn't voted and has < 3 votes, add the vote.
 *
 * Uses Redis SET operations (SADD/SREM/SISMEMBER) for atomic updates —
 * no race conditions when multiple users vote simultaneously.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "ログインが必要です" },
      { status: 401 }
    );
  }

  try {
    const body: { channelId?: string; month?: string } = await request.json();
    const channelId = body.channelId?.trim();
    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 }
      );
    }

    const { votes, error, status } = await toggleVote(session.did, channelId, body.month || "2026-07");
    if (error) {
      return NextResponse.json({ error, votes }, { status: status ?? 500 });
    }
    return NextResponse.json({ votes });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
