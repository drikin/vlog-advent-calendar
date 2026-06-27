import { NextResponse } from "next/server";

// Serve JWKS at /.well-known/jwks.json
export async function GET() {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    return NextResponse.json({ keys: [] });
  }

  const jwk = JSON.parse(PRIVATE_KEY);
  // Return only the public part (remove private key material)
  const publicJwk = {
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    y: jwk.y,
    alg: jwk.alg,
    kid: jwk.kid,
  };

  return NextResponse.json({ keys: [publicJwk] });
}
