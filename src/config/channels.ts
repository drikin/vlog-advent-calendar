export interface Channel {
  id: string;       // YouTube channel ID
  handle: string;   // @handle
  name: string;     // Display name
  color: string;    // Accent color for UI (hex)
}

export const CHANNELS: Channel[] = [
  { id: "UCTfta7Ult6yLu7ru-WInOGg", handle: "@koh",              name: "散財小説ドリキン",             color: "#FF6B6B" },
  { id: "UCFuxphsWDDt210PEVWy883Q", handle: "@KentaYoutube",      name: "tamper's channel",               color: "#4ECDC4" },
  { id: "UCJTvowm2dDsjw71aEHeHjGg", handle: "@散財ギタリストたなかしげつぐ", name: "散財ギタリストたなかしげつぐ", color: "#FFD93D" },
  { id: "UCC1iKYB1Y_KOtHZXk7zY1jg", handle: "@kentakov",          name: "きままにいっkov",               color: "#6C5CE7" },
  { id: "UCtECO9x5EpcH_E2UUN7QqdQ", handle: "@Cohtaro",           name: "こうたろうカメラ日記",          color: "#A8E6CF" },
  { id: "UCIcziIKVG1Y7meKEOXHNlGw", handle: "@eiko3kobe",         name: "EIKO⭐️",                        color: "#FF8A5C" },
  { id: "UCn03CTDReLR6KfMYoHokVGw", handle: "@jun_ya",            name: "jun_ya vlog channel",            color: "#95E1D3" },
  { id: "UCWyzddWvD-GsV1wsLqSP_9A", handle: "@butsuyoku_life",    name: "物欲帳チャンネル",              color: "#F7B731" },
];
