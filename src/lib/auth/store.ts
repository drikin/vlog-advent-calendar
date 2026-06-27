/**
 * OAuth stateStore / sessionStore backed by Upstash Redis via @upstash/redis.
 */

import { Redis } from "@upstash/redis";

function getRedis(): Redis {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.error("[OAuthStore] Missing KV_REST_API_URL or KV_REST_API_TOKEN");
    throw new Error("Missing Upstash Redis credentials");
  }
  return new Redis({ url, token });
}

const STATE_PREFIX = "oauth:state:";
const SESSION_PREFIX = "oauth:session:";

async function redisGet(prefix: string, key: string): Promise<unknown> {
  const redis = getRedis();
  // Use json.get to store/retrieve structured objects
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return redis.json.get(prefix + key);
}

async function redisSet(prefix: string, key: string, value: unknown, ttl: number): Promise<void> {
  const redis = getRedis();
  // Use json.set to store structured objects directly (no JSON.stringify)
  await redis.json.set(prefix + key, "$", value as any);
  await redis.expire(prefix + key, ttl);
}

async function redisDel(prefix: string, key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(prefix + key);
}

/* ─── State Store ─── */

export const stateStore: SimpleStoreLike = {
  async get(key: string) {
    try {
      return (await redisGet(STATE_PREFIX, key)) as any;
    } catch (err) {
      console.error("[stateStore.get] error:", key, err);
      return undefined;
    }
  },
  async set(key: string, value: any) {
    try {
      await redisSet(STATE_PREFIX, key, value, 600);
    } catch (err) {
      console.error("[stateStore.set] error:", key, err);
    }
  },
  async del(key: string) {
    try {
      await redisDel(STATE_PREFIX, key);
    } catch (err) {
      console.error("[stateStore.del] error:", key, err);
    }
  },
};

/* ─── Session Store ─── */

export const sessionStore: SimpleStoreLike = {
  async get(key: string) {
    try {
      return (await redisGet(SESSION_PREFIX, key)) as any;
    } catch (err) {
      console.error("[sessionStore.get] error:", key, err);
      return undefined;
    }
  },
  async set(key: string, value: any) {
    try {
      await redisSet(SESSION_PREFIX, key, value, 60 * 60 * 24 * 30);
    } catch (err) {
      console.error("[sessionStore.set] error:", key, err);
    }
  },
  async del(key: string) {
    try {
      await redisDel(SESSION_PREFIX, key);
    } catch (err) {
      console.error("[sessionStore.del] error:", key, err);
    }
  },
};

// Minimal interface matching @atproto-labs/simple-store SimpleStore<string, any>
interface SimpleStoreLike {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  del(key: string): Promise<void>;
}
