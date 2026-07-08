import { setMembers } from "@/lib/members";
import { DEFAULT_CHANNELS } from "@/lib/members";
import { JULY_DEFAULT_CHANNELS } from "@/lib/members";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const month = "2026-07";
    // Use the default list for July (which now includes jun_ya)
    await setMembers(month, JULY_DEFAULT_CHANNELS);
    return NextResponse.json({ success: true, message: `Members for ${month} reset to default.` });
  } catch (error) {
    console.error("Failed to reset members:", error);
    return NextResponse.json({ success: false, error: "Failed to reset members" }, { status: 500 });
  }
}