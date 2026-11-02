import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDeletion, type CampaignFacts } from "../../lib/delete-account.ts";

const fact = (over: Partial<CampaignFacts> & Pick<CampaignFacts, "id">): CampaignFacts => ({
  name: over.id,
  ownerUid: "",
  memberIds: [],
  organizerIds: [],
  ...over,
});

test("the only member's campaign is deleted with the account", () => {
  const plan = classifyDeletion("ada", [fact({ id: "solo", ownerUid: "ada", memberIds: ["ada"], organizerIds: ["ada"] })]);
  assert.deepEqual(plan.blocking, []);
  assert.deepEqual(plan.deleting.map((campaign) => campaign.id), ["solo"]);
});

test("an organizer with another player is blocked, and that campaign is not deleted", () => {
  const plan = classifyDeletion("ada", [fact({
    id: "table",
    name: "Saltmarsh",
    ownerUid: "ada",
    memberIds: ["ada", "bea"],
    organizerIds: ["ada"],
  })]);
  assert.deepEqual(plan.deleting, []);
  assert.deepEqual(plan.blocking, [{ id: "table", name: "Saltmarsh" }]);
});

test("a player who does not own the campaign is neither blocked nor deleting it", () => {
  const plan = classifyDeletion("bea", [fact({
    id: "table",
    ownerUid: "ada",
    memberIds: ["ada", "bea"],
    organizerIds: ["ada"],
  })]);
  assert.deepEqual(plan.blocking, []);
  assert.deepEqual(plan.deleting, []);
});

test("someone else's campaign is absent from the plan when it is not passed in", () => {
  const plan = classifyDeletion("ada", [fact({ id: "mine", ownerUid: "ada", memberIds: ["ada"], organizerIds: ["ada"] })]);
  assert.equal(plan.deleting.some((campaign) => campaign.id === "theirs"), false);
  assert.equal(plan.blocking.some((campaign) => campaign.id === "theirs"), false);
});
