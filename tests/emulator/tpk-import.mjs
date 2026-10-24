// Emulator-only: firebase emulators (firestore 8085, auth 9099, project demo-tpk) + `next dev` with the same env and TPK_IMPORT_SECRET.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8085";
const BASE = process.env.BASE || "http://127.0.0.1:3123", SECRET = process.env.TPK_IMPORT_SECRET || "test-secret-123";
assert.ok(process.env.FIRESTORE_EMULATOR_HOST.startsWith("127.0.0.1"), "emulator only");
const db = getFirestore(initializeApp({ projectId: "demo-tpk" }));
await fetch(`http://127.0.0.1:8085/emulator/v1/projects/demo-tpk/databases/(default)/documents`, { method: "DELETE" });
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/demo-tpk/accounts`, { method: "DELETE" });
const signup = async (email) => (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "pw123456", returnSecureToken: true }) })).json());
const seth = await signup("sthomas131@gmail.com"), other = await signup("player@example.com");
const uid = seth.localId;
await db.doc(`users/${uid}`).set({ email: "sthomas131@gmail.com", displayName: "Seth" });
const camps = { frost: "Rime of the Frostmaiden", strahd: "Curse of Strahd", salt: "Ghosts of Saltmarsh", bee: "Beerovia", ley1: "Leyfarers: Maloren", ley2: "Leyfarers: Krenn" };
for (const [id, name] of Object.entries(camps)) {
  await db.doc(`campaigns/${id}`).set({ name, ownerUid: uid, status: "active", tz: "America/Los_Angeles" });
  await db.doc(`campaigns/${id}/members/${uid}`).set({ uid, role: "organizer", email: "sthomas131@gmail.com" });
}
// Seth's existing Saltmarsh night with notes and RSVPs.
const existing = { cid: "salt", startsAt: "2026-10-31T19:00:00.000Z", endsAt: "2026-10-31T23:00:00.000Z", tz: "America/Los_Angeles", title: "Saltmarsh 9", location: "Home", status: "scheduled", notes: "Bring minis", recapText: "We sank.", attendance: { a: { uid: "a", state: "in" } }, seq: 3 };
await db.doc("campaigns/salt/sessions/salt-1").set(existing);

const post = (body, auth = SECRET) => fetch(`${BASE}/api/import/tpk`, { method: "POST", headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" }, body: JSON.stringify(body) });
assert.equal((await post([], "wrong")).status, 401);
assert.equal((await fetch(`${BASE}/api/import/tpk`, { method: "POST", body: "[]" })).status, 401);
const L = "5051 SE Hawthorne Blvd, Portland";
const b = (service, startISO, h = 4) => ({ service, startISO, durationHours: h, location: L, source: "tpk", externalKey: `${service}|${startISO}` });
const list = [
  b("Game Master: Max Hobbs (4 HR)", "2026-11-04T18:00:00-08:00"), // Wed -> Frostmaiden auto
  b("Game Master: Max Hobbs (4 HR)", "2026-11-06T18:00:00-08:00"), // Fri -> suggest Strahd
  b("Game Master: Sage Ricci (4 HR)", "2026-10-31T12:00:00-07:00"), // Sat -> links existing salt-1
  b("TLC: Ch. 13 Finale (Choose Your Own)", "2026-11-05T18:30:00-08:00"), // two Leyfarers -> suggest
  b("Beerovia: The Shadowborn Sword", "2026-11-07T15:00:00-08:00"), // auto
  b("Join the Leyfarers", "2026-11-08T12:00:00-08:00"), // marker
  b("Game Master: Isaac Davies (2 HR)", "2026-11-03T19:00:00-08:00", 2), // unassigned
];
const dry = await (await post({ bookings: list, dryRun: true })).json();
assert.equal((await db.collection("pendingBookings").get()).size, 0, "dry run writes nothing");
let r = await (await post(list)).json();
console.log("first", r.created, r.linked, r.pending, r.ignored);
assert.deepEqual([r.created, r.linked, r.pending, r.ignored], [2, 1, 3, 1]);
r = await (await post(list)).json();
assert.deepEqual([r.created, r.unchanged, r.flaggedCancelled], [0, 7, 0], "idempotent");
assert.equal((await db.collection("pendingBookings").get()).size, 7);
const salt = (await db.doc("campaigns/salt/sessions/salt-1").get()).data();
assert.deepEqual(salt, existing, "existing session untouched");
assert.equal((await db.collection("campaigns/salt/sessions").get()).size, 1, "no duplicate");
const frost = (await db.collection("campaigns/frost/sessions").get()).docs.map((d) => d.data());
assert.equal(frost.length, 1); assert.equal(frost[0].title, "Rime of the Frostmaiden"); assert.equal(frost[0].location, "TPK Brewing");
// Beerovia vanishes from Upcoming: flagged, not deleted; session kept.
r = await (await post(list.filter((x) => !x.service.startsWith("Beerovia")))).json();
assert.equal(r.flaggedCancelled, 1);
assert.equal((await db.collection("pendingBookings").where("possiblyCancelled", "==", true).get()).size, 1);
assert.equal((await db.collection("campaigns/bee/sessions").get()).size, 1);

// Assign surface.
const pend = (tok, init = {}) => fetch(`${BASE}/api/import/tpk/pending`, { ...init, headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" } });
assert.equal((await pend(other.idToken)).status, 403, "non-owner blocked");
assert.equal((await fetch(`${BASE}/api/import/tpk/pending`)).status, 401);
let p = await (await pend(seth.idToken)).json();
console.log("pending", p.bookings.map((x) => `${x.service} -> ${x.suggestedCids} ${x.possiblyCancelled ? "CANCELLED?" : ""}`));
assert.equal(p.bookings.length, 4);
const fri = p.bookings.find((x) => x.startISO.startsWith("2026-11-07T02"));
assert.deepEqual(fri.suggestedCids, ["strahd"]);
let a = await (await pend(seth.idToken, { method: "POST", body: JSON.stringify({ action: "assign", id: fri.key, cid: "strahd", saveRule: true }) })).json();
assert.equal(a.ok, true); assert.equal(a.linked, false); assert.equal(a.rule.gm, "Max Hobbs");
const cfg = (await db.doc("tpkImport/config").get()).data();
assert.equal(cfg.rules[0].cid, "strahd");
const isaac = a.bookings.find((x) => x.service.includes("Isaac"));
a = await (await pend(seth.idToken, { method: "POST", body: JSON.stringify({ action: "ignore", id: isaac.key }) })).json();
assert.equal(a.bookings.length, 2);
assert.equal((await pend(seth.idToken, { method: "POST", body: JSON.stringify({ action: "assign", id: a.bookings[0].key, cid: "nope" }) })).status, 403);
console.log("emulator tests passed");
