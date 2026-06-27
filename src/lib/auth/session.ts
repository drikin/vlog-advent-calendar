import { cookies } from "next/headers";
import { getOAuthClient } from "./client";
import type { OAuthSession } from "@atproto/oauth-client-node";

export async function getSession(): Promise<OAuthSession | null> {
  const did = await getDid();
  console.log("[getSession] did from cookie:", did);
  if (!did) return null;

  try {
    const client = await getOAuthClient();
    const session = await client.restore(did);
    console.log("[getSession] client.restore succeeded, did:", session?.did);
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
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
  };
}
