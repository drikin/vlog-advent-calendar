import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileFunction } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Load the real TypeScript modules with an isolated, in-memory Redis boundary.
function setup({ enabled = true, failReads = false, beforeSet } = {}) {
  const data = new Map();
  const writes = [];
  class Redis {
    async get(key) {
      if (failReads) throw new Error("Redis unavailable");
      return data.get(key) ?? null;
    }
    async set(key, value, options) {
      writes.push(key);
      beforeSet?.(data, key);
      if (options?.nx && data.has(key)) return null;
      data.set(key, JSON.parse(value));
      return "OK";
    }
  }
  const cache = new Map();
  function load(name) {
    if (name === "@upstash/redis") return { Redis };
    if (cache.has(name)) return cache.get(name);
    const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    const exports = {};
    compileFunction(outputText, ["require", "exports", "process"])(load, exports, {
      env: enabled ? { KV_REST_API_URL: "https://redis.test", KV_REST_API_TOKEN: "test" } : {},
    });
    cache.set(name, exports);
    return exports;
  }
  return { ...load("members"), ...load("legacy-member-seed"), data, writes };
}

test("all remaining months retain July's members without Redis", async () => {
  const m = setup({ enabled: false });
  for (const month of ["07", "08", "09", "10", "11", "12"]) {
    assert.deepEqual(await m.getMembers(`2026-${month}`), m.JULY_DEFAULT_CHANNELS);
  }
  assert.deepEqual(await m.getMembers("2026-06"), m.DEFAULT_CHANNELS);
});

test("already-seeded November and December inherit the repaired October roster", async () => {
  const m = setup();
  m.data.set("members:2026-10", m.JULY_DEFAULT_CHANNELS);
  m.data.set("members:2026-11", m.LEGACY_MEMBER_SEED);
  m.data.set("members:2026-12", m.LEGACY_MEMBER_SEED);
  for (const month of ["2026-11", "2026-12"]) {
    assert.deepEqual(await m.getMembers(month), m.JULY_DEFAULT_CHANNELS);
    assert.deepEqual(await m.initMembers(month), m.JULY_DEFAULT_CHANNELS);
    assert.deepEqual(m.data.get(`members:${month}`), m.LEGACY_MEMBER_SEED);
  }
});

test("all affected legacy seeds fall back to September without writing", async () => {
  const m = setup();
  const source = m.JULY_DEFAULT_CHANNELS.slice(1);
  m.data.set("members:2026-09", source);
  for (const month of ["2026-10", "2026-11", "2026-12"]) {
    m.data.set(`members:${month}`, m.LEGACY_MEMBER_SEED);
  }
  assert.deepEqual(await m.getMembers("2026-12"), source);
  assert.deepEqual(m.writes, []);
});

test("legacy seeds without a saved predecessor use July defaults", async () => {
  const m = setup();
  m.data.set("members:2026-11", m.LEGACY_MEMBER_SEED);
  assert.deepEqual(await m.getMembers("2026-11"), m.JULY_DEFAULT_CHANNELS);
});

test("the same legacy roster remains authoritative outside the affected months", async () => {
  const m = setup();
  for (const month of ["2026-06", "2026-07", "2026-08", "2026-09", "2027-01"]) {
    m.data.set(`members:${month}`, m.LEGACY_MEMBER_SEED);
    assert.deepEqual(await m.getMembers(month), m.LEGACY_MEMBER_SEED);
  }
});

test("custom legacy arrays are never mistaken for the known seed", async () => {
  const m = setup();
  const seed = m.LEGACY_MEMBER_SEED;
  const variants = [
    seed.slice(1), [...seed].reverse(), [...seed, m.JULY_DEFAULT_CHANNELS[10]],
    ...["name", "handle", "avatar", "color", "id"].map((field) =>
      seed.map((c, i) => i === 0 ? { ...c, [field]: "edited" } : c)),
    seed.map((c, i) => i === 0 ? { ...c, note: "keep" } : c),
  ];
  for (const roster of variants) {
    m.data.set("members:2026-11", roster);
    assert.deepEqual(await m.getMembers("2026-11"), roster);
  }
});

test("object key ordering does not prevent recognition of a legacy seed", async () => {
  const m = setup();
  const reorderedKeys = m.LEGACY_MEMBER_SEED.map((c) =>
    Object.fromEntries(Object.entries(c).reverse()));
  m.data.set("members:2026-11", reorderedKeys);
  assert.deepEqual(await m.getMembers("2026-11"), m.JULY_DEFAULT_CHANNELS);
});

test("an owner can explicitly save even the exact old roster", async () => {
  const m = setup();
  await m.setMembers("2026-11", m.LEGACY_MEMBER_SEED);
  assert.deepEqual(await m.getMembers("2026-11"), m.LEGACY_MEMBER_SEED);
  assert.deepEqual(await m.initMembers("2026-11"), m.LEGACY_MEMBER_SEED);
  assert.deepEqual(await m.getMembers("2026-12"), m.LEGACY_MEMBER_SEED);
});

test("missing October inherits September's saved roster, including additions and removals", async () => {
  const m = setup();
  const roster = [{ ...m.JULY_DEFAULT_CHANNELS[0], name: "Updated name" }];
  m.data.set("members:2026-09", roster);
  assert.deepEqual(await m.getMembers("2026-10"), roster);
  assert.deepEqual(m.writes, []);
});

test("inheritance crosses multiple missing months", async () => {
  const m = setup();
  const roster = m.JULY_DEFAULT_CHANNELS.slice(2);
  m.data.set("members:2026-08", roster);
  assert.deepEqual(await m.getMembers("2026-12"), roster);
});

test("viewing future months does not freeze their roster before a member update", async () => {
  const m = setup();
  await m.getMembers("2026-12");
  const roster = m.JULY_DEFAULT_CHANNELS.slice(1);
  await m.setMembers("2026-09", roster);
  assert.deepEqual(await m.getMembers("2026-12"), roster);
  assert.deepEqual(m.writes, ["members:2026-09"]);
});

test("an explicit target roster, including an empty one, takes precedence", async () => {
  const m = setup();
  m.data.set("members:2026-09", m.JULY_DEFAULT_CHANNELS);
  for (const roster of [m.DEFAULT_CHANNELS.slice(0, 2), []]) {
    m.data.set("members:2026-10", roster);
    assert.deepEqual(await m.getMembers("2026-10"), roster);
    assert.deepEqual(await m.getMembers("2026-11"), roster);
  }
});

test("July's deliberate roster change is a boundary for June inheritance", async () => {
  const m = setup();
  m.data.set("members:2026-06", m.DEFAULT_CHANNELS.slice(0, 1));
  assert.deepEqual(await m.getMembers("2026-07"), m.JULY_DEFAULT_CHANNELS);
  assert.deepEqual(await m.getMembers("2026-12"), m.JULY_DEFAULT_CHANNELS);
});

test("Redis read failures return current defaults without any writes", async () => {
  const m = setup({ failReads: true });
  assert.deepEqual(await m.getMembers("2026-10"), m.JULY_DEFAULT_CHANNELS);
  assert.deepEqual(m.writes, []);
});

test("initialization uses the inherited roster, not the first month's roster", async () => {
  const m = setup();
  const roster = m.JULY_DEFAULT_CHANNELS.slice(1);
  m.data.set("members:2026-09", roster);
  assert.deepEqual(await m.initMembers("2026-10"), roster);
  assert.deepEqual(m.data.get("members:2026-10"), { kind: "explicit-members-v1", channels: roster });
});

test("initialization can resolve an explicit source through missing months", async () => {
  const m = setup();
  const roster = m.JULY_DEFAULT_CHANNELS.slice(1);
  m.data.set("members:2026-07", roster);
  assert.deepEqual(await m.initMembers("2026-12", "2026-08"), roster);
});

test("initialization preserves an explicitly empty target", async () => {
  const m = setup();
  m.data.set("members:2026-10", []);
  assert.deepEqual(await m.initMembers("2026-10", "2026-09"), []);
  assert.deepEqual(m.writes, []);
});

test("initialization without Redis uses the correct month defaults", async () => {
  const m = setup({ enabled: false });
  assert.deepEqual(await m.initMembers("2026-10"), m.JULY_DEFAULT_CHANNELS);
  assert.deepEqual(await m.initMembers("2026-10", "2026-06"), m.DEFAULT_CHANNELS);
});

test("initialization preserves an owner update made during initialization", async () => {
  const roster = [];
  const m = setup({ beforeSet: (data, key) => data.set(key, roster) });
  assert.deepEqual(await m.initMembers("2026-10"), roster);
  assert.deepEqual(m.data.get("members:2026-10"), roster);
});

test("initialization does not save fallback data when Redis reads fail", async () => {
  const m = setup({ failReads: true });
  await assert.rejects(m.initMembers("2026-10"), /Redis unavailable/);
  assert.deepEqual(m.writes, []);
});

test("admin reset defaults retain the new roster through December", () => {
  const m = setup();
  for (const month of ["07", "08", "09", "10", "11", "12"]) {
    assert.deepEqual(m.getDefaultMembers(`2026-${month}`), m.JULY_DEFAULT_CHANNELS);
  }
  assert.deepEqual(m.getDefaultMembers("2026-06"), m.DEFAULT_CHANNELS);
});
