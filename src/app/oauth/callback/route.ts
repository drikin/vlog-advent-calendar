import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/auth/client";
import { makeDidCookieOptions } from "@/lib/auth/session";

const PUBLIC_URL = process.env.PUBLIC_URL || "http://127.0.0.1:3000";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const client = await getOAuthClient();

    // This writes the session to Upstash Redis (sessionStore.set is awaited internally)
    const { session } = await client.callback(params);

    // Return HTML page with meta refresh instead of 302 redirect.
    // This ensures the browser fully processes the Set-Cookie header
    // (writes it to the cookie jar) before navigating to "/".
    // 302 redirects can race: browser may send the GET to "/" before
    // the cookie is stored, causing the server to see no cookie.
    const cookieValue = encodeURIComponent(session.did);
    const cookieOpts = makeDidCookieOptions(process.env.NODE_ENV === "production");
    const setCookie = `did=${cookieValue}; HttpOnly; ${cookieOpts.secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=${cookieOpts.maxAge}`;

    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=/">
  <style>
    body { background: #0a0a0a; color: #888; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
  </style>
</head>
<body>
  <p>ログイン中…</p>
  <script>window.location.href = "/";</script>
</body>
</html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Set-Cookie": setCookie,
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/?error=login_failed", PUBLIC_URL));
  }
}
