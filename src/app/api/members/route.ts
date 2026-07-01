import { NextRequest, NextResponse } from "next/server";
import { getMembers, setMembers } from "@/lib/members";
import { getSession } from "@/lib/auth/session";
import { resolveProfile } from "@/lib/auth/did-resolver";

/**
 * GET /api/members?month=2026-07
 * Returns the member list for a given month.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || "2026-06";

  const members = await getMembers(month);
  return NextResponse.json({ month, members });
}

/**
 * POST /api/members
 * Update member list for a month. Requires authentication (owner only).
 *
 * Body: { month: string, members: Channel[] }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  // Only the owner (koh.bsky.social) can modify members
  const profile = await resolveProfile(session.did);
  const isOwner = profile?.handle === "koh.bsky.social";
  if (!isOwner) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { month, members } = body;

    if (!month || !Array.isArray(members)) {
      return NextResponse.json({ error: "Invalid body: { month, members }" }, { status: 400 });
    }

    await setMembers(month, members);
    return NextResponse.json({ success: true, month, count: members.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
