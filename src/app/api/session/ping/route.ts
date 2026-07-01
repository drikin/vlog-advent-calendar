import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/session/ping — keep the session alive.
 *
 * Called periodically by the client to extend the session TTL in Redis.
 * Returns { ok: true } if session is valid, { ok: false } if not logged in.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
