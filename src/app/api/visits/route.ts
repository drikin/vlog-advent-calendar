import { NextResponse } from "next/server";
import { incrAndGetVisits } from "@/lib/visits";

export async function GET() {
  try {
    const count = await incrAndGetVisits();
    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
