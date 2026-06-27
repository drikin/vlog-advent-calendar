import { type NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getSession } from "@/lib/auth/session";

export interface RsvpEntry {
  name: string;
  did: string; // owner's DID (Bluesky)
  status: "confirmed" | "maybe" | "interested";
  comment: string;
  createdAt: string;
}

const KV_KEY = "rsvp:jul4";

function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

async function getEntries(): Promise<RsvpEntry[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const raw = await redis.get(KV_KEY);
    if (Array.isArray(raw)) return raw as RsvpEntry[];
    return [];
  } catch {
    return [];
  }
}

async function saveEntries(entries: RsvpEntry[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(KV_KEY, entries);
}

/**
 * GET /api/rsvp — return all entries (no auth required)
 */
export async function GET() {
  const entries = await getEntries();
  return NextResponse.json({ entries });
}

/**
 * POST /api/rsvp — create or update own entry (auth required)
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const userDid = session.did;

  try {
    const body: { name: string; status: string; comment: string } =
      await request.json();
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const validStatuses = ["confirmed", "maybe", "interested"] as const;
    const status = validStatuses.includes(body.status as any)
      ? body.status
      : "interested";

    const newEntry: RsvpEntry = {
      name,
      did: userDid,
      status: status as RsvpEntry["status"],
      comment: body.comment?.trim() || "",
      createdAt: new Date().toISOString(),
    };

    let entries = await getEntries();
    // Find existing entry by DID (one entry per user)
    const existingIdx = entries.findIndex((e) => e.did === userDid);
    if (existingIdx >= 0) {
      // Update: keep createdAt from original, allow name/status/comment change
      newEntry.createdAt = entries[existingIdx].createdAt;
      entries[existingIdx] = newEntry;
    } else {
      entries.push(newEntry);
    }

    await saveEntries(entries);
    return NextResponse.json({ entries });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * DELETE /api/rsvp — delete own entry (auth required)
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const userDid = session.did;

  try {
    const body: { name?: string } = await request.json();
    let entries = await getEntries();

    // Only delete own entry
    entries = entries.filter((e) => e.did !== userDid);
    await saveEntries(entries);

    return NextResponse.json({ entries });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
