import { setMembers } from "@/lib/members";
import { DEFAULT_CHANNELS } from "@/lib/members";
import { JULY_DEFAULT_CHANNELS } from "@/lib/members";
import { NextRequest, NextResponse } from "next/server";

// 月ごとのデフォルトリスト（getMembers と同じマッピング）
const DEFAULTS_BY_MONTH: Record<string, typeof JULY_DEFAULT_CHANNELS> = {
  "2026-07": JULY_DEFAULT_CHANNELS,
  "2026-08": JULY_DEFAULT_CHANNELS, // 8月は7月から引き継ぎ
};

export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get("month") || "2026-07";
    const defaults = DEFAULTS_BY_MONTH[month] ?? DEFAULT_CHANNELS;
    await setMembers(month, defaults);
    return NextResponse.json({ success: true, message: `Members for ${month} reset to default.` });
  } catch (error) {
    console.error("Failed to reset members:", error);
    return NextResponse.json({ success: false, error: "Failed to reset members" }, { status: 500 });
  }
}