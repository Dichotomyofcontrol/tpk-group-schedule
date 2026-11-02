// Emulator only. Never point this at production.
// firebase emulators:exec --project demo-tpk --only auth,firestore,storage "node --import tsx tests/emulator/delete-account.mjs"
import assert from "node:assert/strict";

const local = (value) => /^127\.0\.0\.1:\d+$/.test(value || "") || /^localhost:\d+$/.test(value || "");
assert.ok(local(process.env.FIRESTORE_EMULATOR_HOST), "FIRESTORE_EMULATOR_HOST must be the local emulator");
assert.ok(local(process.env.FIREBASE_AUTH_EMULATOR_HOST), "FIREBASE_AUTH_EMULATOR_HOST must be the local emulator");
assert.ok(local(process.env.FIREBASE_STORAGE_EMULATOR_HOST), "FIREBASE_STORAGE_EMULATOR_HOST must be the local emulator");
const project = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "";
assert.equal(project, "demo-tpk", "refusing to run against any project but the demo emulator");
assert.notEqual(project, "tpk-group-8cdc8");
delete process.env.FIREBASE_SERVICE_ACCOUNT;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
process.env.FIREBASE_PROJECT_ID = "demo-tpk";
process.env.FIREBASE_STORAGE_BUCKET = "demo-tpk.appspot.com";

const { adminBucket, adminDb } = await import("../../lib/firebase-admin.ts");
const { DELETE, GET } = await import("../../app/api/account/route.ts");
const { getAuth } = await import("firebase-admin/auth");

const db = adminDb();
const bucket = adminBucket();
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;

await fetch(`http://${firestoreHost}/emulator/v1/projects/demo-tpk/databases/(default)/documents`, { method: "DELETE" });
await fetch(`http://${authHost}/emulator/v1/projects/demo-tpk/accounts`, { method: "DELETE" });

async function signup(email) {
  const res = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "pw123456", returnSecureToken: true }),
  });
  const body = await res.json();
  assert.equal(res.ok, true, JSON.stringify(body));
  return body;
}

async function savePortrait(path, text) {
  await bucket.file(path).save(Buffer.from(text), { contentType: "image/png" });
}

async function portraitExists(path) {
  const [exists] = await bucket.file(path).exists();
  return exists;
}

const ada = await signup("ada@example.com");
const bea = await signup("bea@example.com");
const adaUid = ada.localId;
const beaUid = bea.localId;

await db.doc(`users/${adaUid}`).set({ email: "ada@example.com", displayName: "Ada", calToken: "ada-cal" });
await db.doc(`users/${beaUid}`).set({ email: "bea@example.com", displayName: "Bea", calToken: "bea-cal" });
await db.doc("calTokens/ada-cal").set({ uid: adaUid });
await db.doc("calTokens/bea-cal").set({ uid: beaUid });
await db.doc(`users/${adaUid}/devices/phone`).set({ token: "ada-phone", platform: "ios" });
await db.doc(`users/${beaUid}/devices/phone`).set({ token: "bea-phone", platform: "ios" });

await db.doc("campaigns/solo").set({
  name: "Ada Alone",
  ownerUid: adaUid,
  status: "active",
  characters: [{ name: "Solo", ownerEmail: "ada@example.com", imagePath: "recaps/avatars/solo_Solo.png" }],
});
await db.doc("campaigns/solo/members/" + adaUid).set({ uid: adaUid, email: "ada@example.com", role: "organizer" });
await db.doc("campaigns/solo/sessions/night").set({ title: "Only Ada", attendance: { [adaUid]: { uid: adaUid, state: "in" } } });
await db.doc("campaigns/solo/polls/when").set({ title: "When", votes: { [adaUid]: { picks: { a: true } } } });
await savePortrait("recaps/avatars/solo_Solo.png", "ada-solo");
await savePortrait("campaigns/solo/cover-1.jpg", "cover");

await db.doc("campaigns/shared").set({
  name: "Shared Table",
  ownerUid: beaUid,
  status: "active",
  characters: [
    { name: "Ada's PC", ownerEmail: "ada@example.com", imagePath: "recaps/avatars/shared_Ada.png" },
    { name: "Bea's PC", ownerEmail: "bea@example.com", imagePath: "recaps/avatars/shared_Bea.png" },
  ],
});
await db.doc(`campaigns/shared/members/${adaUid}`).set({ uid: adaUid, email: "ada@example.com", role: "member" });
await db.doc(`campaigns/shared/members/${beaUid}`).set({ uid: beaUid, email: "bea@example.com", role: "organizer" });
await db.doc("campaigns/shared/polls/when").set({
  title: "When",
  votes: {
    [adaUid]: { picks: { a: true }, name: "Ada" },
    [beaUid]: { picks: { b: true }, name: "Bea" },
  },
});
await db.doc("campaigns/shared/sessions/night").set({
  attendance: {
    [adaUid]: { uid: adaUid, state: "out" },
    [beaUid]: { uid: beaUid, state: "in" },
  },
});
await db.doc("campaigns/shared/roster/ada-seat").set({ memberId: adaUid, email: "ada@example.com", name: "Ada", token: "ada-seat-token" });
await db.doc("campaigns/shared/roster/bea-seat").set({ memberId: beaUid, email: "bea@example.com", name: "Bea", token: "bea-seat-token" });
await db.doc("rosterTokens/ada-seat-token").set({ cid: "shared", id: "ada-seat" });
await db.doc("rosterTokens/bea-seat-token").set({ cid: "shared", id: "bea-seat" });
await savePortrait("recaps/avatars/shared_Ada.png", "ada-face");
await savePortrait("recaps/avatars/shared_Bea.png", "bea-face");

await db.doc("campaigns/bea-table").set({ name: "Bea Owns", ownerUid: beaUid, status: "active" });
await db.doc(`campaigns/bea-table/members/${beaUid}`).set({ uid: beaUid, email: "bea@example.com", role: "organizer" });
await db.doc("campaigns/bea-table/members/cy").set({ uid: "cy", email: "cy@example.com", role: "member" });
await db.doc("campaigns/bea-table/polls/when").set({ votes: { [beaUid]: { picks: { a: true } } } });

const call = (method, token, body) => {
  const request = new Request("http://127.0.0.1/api/account", {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return method === "GET" ? GET(request) : DELETE(request);
};

assert.equal((await call("DELETE", "", { uid: beaUid })).status, 401);

const blocked = await call("DELETE", bea.idToken, { uid: adaUid });
assert.equal(blocked.status, 409);
const blockedBody = await blocked.json();
assert.equal(blockedBody.blocking[0].id, "bea-table");
assert.ok((await db.doc(`users/${adaUid}`).get()).exists, "Bea's request must not delete Ada");
assert.ok((await db.doc(`users/${beaUid}`).get()).exists, "a blocked delete removes nothing");
assert.ok((await db.doc("campaigns/bea-table").get()).exists);
assert.equal((await getAuth().getUser(adaUid)).email, "ada@example.com");

const plan = await (await call("GET", ada.idToken)).json();
assert.deepEqual(plan.deleting.map((campaign) => campaign.id), ["solo"]);
assert.deepEqual(plan.blocking, []);

const removed = await call("DELETE", ada.idToken, { uid: beaUid });
assert.equal(removed.status, 200, JSON.stringify(await removed.clone().json()));

assert.equal((await db.doc(`users/${adaUid}`).get()).exists, false);
assert.equal((await db.doc(`users/${adaUid}/devices/phone`).get()).exists, false);
assert.equal((await db.doc("calTokens/ada-cal").get()).exists, false);
assert.equal((await db.doc("campaigns/solo").get()).exists, false);
assert.equal(await portraitExists("recaps/avatars/solo_Solo.png"), false);
assert.equal(await portraitExists("campaigns/solo/cover-1.jpg"), false);
await assert.rejects(() => getAuth().getUser(adaUid));

assert.equal((await db.doc("campaigns/shared/members/" + adaUid).get()).exists, false);
assert.equal((await db.doc("campaigns/shared/roster/ada-seat").get()).exists, false);
assert.equal((await db.doc("rosterTokens/ada-seat-token").get()).exists, false);
const sharedPoll = (await db.doc("campaigns/shared/polls/when").get()).get("votes");
assert.equal(adaUid in sharedPoll, false);
assert.equal(sharedPoll[beaUid].name, "Bea");
const attendance = (await db.doc("campaigns/shared/sessions/night").get()).get("attendance");
assert.equal(adaUid in attendance, false);
assert.equal(attendance[beaUid].state, "in");
assert.equal(await portraitExists("recaps/avatars/shared_Ada.png"), false);
const characters = (await db.doc("campaigns/shared").get()).get("characters");
assert.equal(characters.find((character) => character.name === "Ada's PC").imagePath, undefined);
assert.equal(characters.find((character) => character.name === "Bea's PC").imagePath, "recaps/avatars/shared_Bea.png");
assert.equal(await portraitExists("recaps/avatars/shared_Bea.png"), true);

assert.ok((await db.doc(`users/${beaUid}`).get()).exists);
assert.equal((await db.doc(`users/${beaUid}`).get()).get("displayName"), "Bea");
assert.ok((await db.doc(`users/${beaUid}/devices/phone`).get()).exists);
assert.ok((await db.doc("calTokens/bea-cal").get()).exists);
assert.ok((await db.doc("campaigns/bea-table").get()).exists);
assert.ok((await db.doc(`campaigns/bea-table/members/${beaUid}`).get()).exists);
assert.equal((await db.doc("campaigns/bea-table/polls/when").get()).get("votes")[beaUid].picks.a, true);
assert.ok((await db.doc("campaigns/shared/roster/bea-seat").get()).exists);
assert.equal((await getAuth().getUser(beaUid)).email, "bea@example.com");

console.log("delete-account emulator test: ok");
