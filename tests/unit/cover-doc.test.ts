import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCampaignDocWrites, cadencePatchForMerge, campaignPatchForMerge, durableCoverSrc } from "../../lib/cover-doc.ts";
import type { Campaign } from "../../lib/types.ts";

const saved = {
  src: "https://firebasestorage.googleapis.com/v0/b/bucket/o/campaigns%2Fsalt%2Fcover-2.jpg?alt=media&token=abc",
  path: "campaigns/salt/cover-2.jpg",
  focalX: 0.5,
  focalY: 0.5,
};

test("a cover upload survives the create race and a later settings save", () => {
  const created = {
    name: "Saltmarsh",
    ownerUid: "seth",
    cover: { src: "", path: null, focalX: 0.5, focalY: 0.5 },
  };

  // The old create wrote the whole document without waiting. When that write
  // landed after the cover merge, refresh loaded path null and the cover was gone.
  const wiped = applyCampaignDocWrites(null, [
    { mode: "merge", data: { cover: saved } },
    { mode: "replace", data: created },
  ]);
  assert.equal((wiped?.cover as { path: string | null }).path, null);

  const kept = applyCampaignDocWrites(null, [
    { mode: "replace", data: created },
    { mode: "merge", data: { cover: saved } },
    { mode: "merge", data: campaignPatchForMerge({ name: "Ghosts of Saltmarsh", cover: { src: "", path: null, focalX: 0.5, focalY: 0.5 } } as Partial<Campaign>) },
    { mode: "merge", data: cadencePatchForMerge({ cadence: null, defaultLocation: "TPK Brewing", tz: "America/Los_Angeles" }) },
  ]);
  assert.equal((kept?.cover as typeof saved).path, saved.path);
  assert.equal((kept?.cover as typeof saved).src, saved.src);
  assert.equal(kept?.name, "Ghosts of Saltmarsh");
  assert.equal(kept?.defaultLocation, "TPK Brewing");
  assert.equal(durableCoverSrc(saved.src), saved.src);
});

test("settings merges never carry a cover, and blob urls are not durable", () => {
  const patch = campaignPatchForMerge({
    name: "Saltmarsh",
    cover: saved,
    id: "salt",
  } as Partial<Campaign>);
  assert.deepEqual(patch, { name: "Saltmarsh" });
  assert.equal(durableCoverSrc("blob:http://localhost/cover"), "");
  assert.equal(durableCoverSrc(""), "");
  assert.equal(durableCoverSrc("data:image/jpeg;base64,abc"), "data:image/jpeg;base64,abc");
});
