import { NextResponse } from "next/server";
import { buildSiteData } from "@/lib/data";

export const dynamic = "auto";

export async function GET() {
  try {
    const data = await buildSiteData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch YouTube data:", error);
    return NextResponse.json(
      { error: "Failed to fetch YouTube data", details: String(error) },
      { status: 500 }
    );
  }
}
