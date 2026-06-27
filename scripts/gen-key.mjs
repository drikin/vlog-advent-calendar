import crypto from "node:crypto";

// Generate ES256 (ECDSA P-256) key pair and output as JWK with kid
const keyPair = crypto.generateKeyPairSync("ec", {
  namedCurve: "P-256",
  privateKeyEncoding: { type: "pkcs8", format: "jwk" },
  publicKeyEncoding: { type: "spki", format: "jwk" },
});

// Generate a unique key ID (thumbprint of public key)
const thumbprint = crypto
  .createHash("sha256")
  .update(keyPair.publicKey.x + keyPair.publicKey.y)
  .digest("base64url")
  .slice(0, 8);

const privateJwk = {
  ...keyPair.privateKey,
  alg: "ES256",
  kid: thumbprint,
};

console.log(JSON.stringify(privateJwk, null, 2));
