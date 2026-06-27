import {
  JoseKey,
  Keyset,
  NodeOAuthClient,
} from "@atproto/oauth-client-node";
import type {
  OAuthClientMetadataInput,
} from "@atproto/oauth-client-node";
import { stateStore, sessionStore } from "./store";

let client: NodeOAuthClient | null = null;

const PUBLIC_URL = process.env.PUBLIC_URL;

// The scope "atproto" is sufficient for authentication-only ("login with atproto")
export const SCOPE = "atproto";

function getClientMetadata(): OAuthClientMetadataInput {
  if (PUBLIC_URL) {
    return {
      client_id: `${PUBLIC_URL}/.well-known/oauth-client-metadata`,
      client_name: "Vlog強化月間 アドベントカレンダー",
      client_uri: PUBLIC_URL,
      redirect_uris: [`${PUBLIC_URL}/oauth/callback`],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: SCOPE,
      token_endpoint_auth_method: "private_key_jwt",
      token_endpoint_auth_signing_alg: "ES256",
      jwks_uri: `${PUBLIC_URL}/.well-known/jwks.json`,
      dpop_bound_access_tokens: true,
    };
  } else {
    // Loopback local dev
    return {
      client_id: "http://127.0.0.1:3000/.well-known/oauth-client-metadata",
      client_name: "Vlog強化月間 (dev)",
      client_uri: "http://127.0.0.1:3000",
      redirect_uris: ["http://127.0.0.1:3000/oauth/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: SCOPE,
      token_endpoint_auth_method: "none",
      dpop_bound_access_tokens: false,
    };
  }
}

async function getKeyset(): Promise<Keyset | undefined> {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (PUBLIC_URL && PRIVATE_KEY) {
    const jwk = JSON.parse(PRIVATE_KEY);
    return new Keyset([await JoseKey.fromJWK(jwk)]);
  }
  return undefined;
}

export async function getOAuthClient(): Promise<NodeOAuthClient> {
  if (client) return client;

  client = new NodeOAuthClient({
    clientMetadata: getClientMetadata(),
    keyset: await getKeyset(),
    stateStore,
    sessionStore,
  });

  return client;
}
