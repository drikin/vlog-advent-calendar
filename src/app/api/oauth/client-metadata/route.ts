import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/auth/client";

export async function GET() {
  const client = await getOAuthClient();
  return NextResponse.json(client.clientMetadata);
}
