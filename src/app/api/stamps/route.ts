import { NextRequest, NextResponse } from "next/server";
import { toggleStamp, type StampType } from "@/lib/stamps";

export async function POST(request: NextRequest) {
  try {
    const { videoId, stamp } = await request.json();
    if (!videoId || !stamp) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const validStamps = ["👍", "🔥", "🎉", "❤️"];
    if (!validStamps.includes(stamp)) {
      return NextResponse.json({ error: "Invalid stamp" }, { status: 400 });
    }

    // Get client IP from headers
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

    const result = await toggleStamp(videoId, ip, stamp as StampType);
    if (!result) {
      return NextResponse.json({ error: "Stamp service unavailable" }, { status: 503 });
    }

    return NextResponse.json({
      videoId,
      stamp,
      counts: result.counts,
      action: result.action,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
