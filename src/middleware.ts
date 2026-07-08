import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SOURCE_HOST = "vlog-advent-calendar.vercel.app";
const TARGET_HOST = "dvlog.jp";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const url = request.nextUrl;

  // OAuth metadata / JWKS はリダイレクトせず .vercel.app で直接提供
  if (host === SOURCE_HOST && !url.pathname.startsWith("/.well-known/")) {
    const target = new URL(request.url);
    target.host = TARGET_HOST;
    target.protocol = "https:";
    return NextResponse.redirect(target, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
