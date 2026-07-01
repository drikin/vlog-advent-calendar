import { cookies } from "next/headers";
import { getOAuthClient } from "./client";
import { sessionStore } from "./store";
import type { OAuthSession } from "@atproto/oauth-client-node";

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

/**
 * Refresh the session TTL in Redis to keep it alive.
 * Called on every successful session restore.
 */
async function touchSession(did: string): Promise<void> {
  try {
    // Re-set the session with a fresh TTL (30 days from now)
    const raw = await sessionStore.get(did);
    if (raw) {
      await sessionStore.set(did, raw);
    }
  } catch {
    // Non-fatal — session still works
  }
}

export async function getSession(): Promise<OAuthSession | null> {
  const did = await getDid();
  if (!did) return null;

  try {
    const client = await getOAuthClient();
    const session = await client.restore(did);
    if (session) {
      // Extend session TTL on every successful access
      await touchSession(did);
    }
    return session;
  } catch (err) {
    console.error("[getSession] client.restore failed for DID:", did);
    console.error("[getSession] error:", err instanceof Error ? err.message : String(err));
    console.error("[getSession] stack:", err instanceof Error ? err.stack : "(no stack)");
    return null;
  }
}

export async function getDid(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("did")?.value ?? null;
}

export function makeDidCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days — match session TTL
    path: "/",
  };
}
