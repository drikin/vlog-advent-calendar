import { NextRequest, NextResponse } from "next/server";
import { makeDidCookieOptions } from "@/lib/auth/session";
import { sessionStore } from "@/lib/auth/store";

const PUBLIC_URL = process.env.PUBLIC_URL || "http://127.0.0.1:3000";

export async function POST(request: NextRequest) {
  try {
    // Read DID from cookie to know which session to delete
    const did = request.cookies.get("did")?.value;
    if (did) {
      // Delete session from Upstash Redis
      await sessionStore.del(did);
    }
  } catch (err) {
    console.error("[logout] failed to delete session:", err);
    // Continue anyway — cookie will be cleared
  }

  const response = NextResponse.redirect(new URL("/", PUBLIC_URL));

  // Clear the did cookie
  response.cookies.set("did", "", {
    ...makeDidCookieOptions(process.env.NODE_ENV === "production"),
    maxAge: 0,
  });

  return response;
}
