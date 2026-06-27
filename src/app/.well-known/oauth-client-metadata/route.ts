import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/auth/client";

// Serve OAuth client metadata at the well-known path
// GET /.well-known/oauth-client-metadata
export async function GET() {
  const client = await getOAuthClient();
  return NextResponse.json(client.clientMetadata);
}
