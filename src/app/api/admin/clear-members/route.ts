import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export async function GET() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return NextResponse.json({ error: "KV not configured" }, { status: 500 });
  }
  const redis = new Redis({ url, token });
  try {
    await redis.del("members:2026-07");
    return NextResponse.json({ success: true, deleted: "members:2026-07" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
