import { getDefaultMembers, setMembers } from "@/lib/members";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get("month") || "2026-07";
    const defaults = getDefaultMembers(month);
    await setMembers(month, defaults);
    return NextResponse.json({ success: true, message: `Members for ${month} reset to default.` });
  } catch (error) {
    console.error("Failed to reset members:", error);
    return NextResponse.json({ success: false, error: "Failed to reset members" }, { status: 500 });
  }
}
