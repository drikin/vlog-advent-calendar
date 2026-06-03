import { NextResponse } from "next/server";
import { buildSiteData } from "@/lib/data";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  noStore();
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
