import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { recordedCampaign, recordedKey, setRecorded, tpkAwards } from "../../lib/almanac-stats.ts";
import { DEMO_RECORDED, LIVE_RECORDED, liveMemberCampaigns, recordedPayload } from "../../lib/almanac-records.server.ts";
import { GET } from "../../app/api/almanac/recorded/route.ts";

test("live mapping is the exact Firestore campaign ids", () => {
  assert.deepEqual(Object.keys(LIVE_RECORDED).sort(), ["frostmaiden", "ghosts-of-saltmarsh", "strahd"]);
});

test("similar names, slugs or ids never pick up recorded stats", () => {
  setRecorded(recordedPayload(Object.keys(DEMO_RECORDED), DEMO_RECORDED));
  for (const id of ["curse-of-strahd", "strahd2", "Strahd", "my-frostmaiden", "rime", "saltmarsh-homebrew", "ghosts", "x"]) {
    assert.equal(recordedKey({ id, slug: "strahd", name: "Curse of Strahd" } as { id: string }), null, id);
    assert.equal(recordedCampaign(id), null, id);
  }
  setRecorded(null);
});

test("payload only carries the campaigns passed in, rekeyed to their ids", () => {
  const one = recordedPayload(["ghosts-of-saltmarsh", "beerovia"], LIVE_RECORDED);
  assert.deepEqual(Object.keys(one.campaigns), ["ghosts-of-saltmarsh"]);
  assert.ok(one.moments.every((m) => m.campaignId === "ghosts-of-saltmarsh"));
  assert.deepEqual(recordedPayload([], LIVE_RECORDED).campaigns, {});
  setRecorded(one);
  assert.ok(recordedCampaign("ghosts-of-saltmarsh"));
  assert.equal(recordedCampaign("saltmarsh"), null);
  assert.ok(tpkAwards(["ghosts-of-saltmarsh", "strahd"]).every((a) => a.campaignId === "ghosts-of-saltmarsh"));
  setRecorded(null);
});

function fakeDb(members: Record<string, Record<string, { pending?: boolean }>>) {
  return {
    collection: () => ({
      doc: (cid: string) => ({
        collection: () => ({
          doc: (uid: string) => ({
            get: async () => ({ exists: !!members[cid]?.[uid], data: () => members[cid]?.[uid] }),
          }),
        }),
      }),
    }),
  } as never;
}

test("membership check: only real members of each campaign", async () => {
  const db = fakeDb({ strahd: { seth: {}, ann: {}, pend: { pending: true } }, frostmaiden: { seth: {} }, "ghosts-of-saltmarsh": { seth: {} } });
  assert.deepEqual(await liveMemberCampaigns(db, "seth"), ["frostmaiden", "strahd", "ghosts-of-saltmarsh"]);
  assert.deepEqual(await liveMemberCampaigns(db, "ann"), ["strahd"]);
  assert.deepEqual(await liveMemberCampaigns(db, "pend"), []);
  assert.deepEqual(await liveMemberCampaigns(db, "stranger"), []);
  assert.deepEqual(await liveMemberCampaigns(db, ""), []);
});

test("route (demo): non-members and anonymous callers get nothing", async () => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  const anon = await (await GET(new Request("http://x/api/almanac/recorded"))).json();
  assert.deepEqual(anon.campaigns, {});
  assert.deepEqual(anon.moments, []);
  const outsider = await (await GET(new Request("http://x/api/almanac/recorded", { headers: { "x-demo-persona": "nobody" } }))).json();
  assert.deepEqual(outsider.campaigns, {});
  const seth = await (await GET(new Request("http://x/api/almanac/recorded", { headers: { "x-demo-persona": "seth" } }))).json();
  assert.ok(Object.keys(seth.campaigns).length >= 1);
  process.env.VERCEL_ENV = "production";
  assert.equal((await GET(new Request("http://x/api/almanac/recorded", { headers: { "x-demo-persona": "seth" } }))).status, 503);
  delete process.env.VERCEL_ENV;
});

test("route (live): no token means 401 and no stats", async () => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:1";
  const res = await GET(new Request("http://x/api/almanac/recorded"));
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.campaigns, undefined);
  delete process.env.FIRESTORE_EMULATOR_HOST;
});

test("only the server module imports the raw stats", () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (["node_modules", ".next", ".git", "tests", "data"].includes(name)) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(tsx?|mjs|js)$/.test(name) && /from\s+["'][^"']*almanac-stats\.json["']/.test(readFileSync(path, "utf8"))) hits.push(path);
    }
  };
  walk(".");
  assert.deepEqual(hits, ["lib/almanac-records.server.ts"]);
});
