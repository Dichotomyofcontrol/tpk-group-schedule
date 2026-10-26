// Run: firebase emulators:exec --only firestore --project demo-tpk "node --import tsx tests/emulator/seat-claim.mjs"
import assert from "node:assert/strict";
process.env.FIREBASE_PROJECT_ID ||= "demo-tpk";
const { adminDb } = await import("../../lib/firebase-admin.ts");
const { claimRosterSeat, previewSeat } = await import("../../lib/roster-server.ts");
const db = adminDb();
const cid = "ghosts-test";
const token = "seatTokenEmu_12345";
await db.collection("campaigns").doc(cid).set({ name: "Ghosts (emulator)", status: "active" });
await db.collection("campaigns").doc(cid).collection("members").doc("uid-seth").set({ id: "uid-seth", role: "organizer" });
await db.collection("campaigns").doc(cid).collection("roster").doc("rp_1").set({ id: "rp_1", cid, name: "Nick", characterName: "Dom", status: "invited", token, createdAt: "2026-10-25T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z", linkSharedAt: "2026-10-26T00:00:00Z" });
await db.collection("rosterTokens").doc(token).set({ cid, id: "rp_1" });

const before = await previewSeat(token, "uid-nick");
assert.equal(before.claimed, false);
const [a, b] = await Promise.all([
  claimRosterSeat(token, { id: "uid-nick", email: "nick@example.com", displayName: "Nick" }),
  claimRosterSeat(token, { id: "uid-eve", email: "eve@example.com", displayName: "Eve" }),
]);
const wins = [a, b].filter((r) => r.ok);
assert.equal(wins.length, 1, "exactly one claim wins");
const loser = [a, b].find((r) => !r.ok);
assert.match(loser.error, /already claimed/);
const winner = wins[0].player.memberId;
const after = await previewSeat(token, winner);
assert.equal(after.claimed, true);
assert.equal(after.mine, true);
assert.equal(after.status, "joined");
assert.ok((await db.collection("campaigns").doc(cid).collection("members").doc(winner).get()).exists);
const again = await claimRosterSeat(token, { id: winner, email: "x@example.com", displayName: "" });
assert.ok(again.ok && again.already);
console.log("seat-claim emulator test: ok");
