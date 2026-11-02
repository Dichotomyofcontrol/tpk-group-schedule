// Emulator only. Never point this at production.
// firebase emulators:exec --project demo-tpk --only auth,firestore,storage "node --import tsx tests/emulator/storage-avatars.mjs"
import assert from "node:assert/strict";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { connectStorageEmulator, getBytes, getDownloadURL, getStorage, ref, uploadString } from "firebase/storage";

const local = (value) => /^127\.0\.0\.1:\d+$/.test(value || "") || /^localhost:\d+$/.test(value || "");
assert.ok(local(process.env.FIRESTORE_EMULATOR_HOST), "firestore emulator only");
assert.ok(local(process.env.FIREBASE_AUTH_EMULATOR_HOST), "auth emulator only");
assert.ok(local(process.env.FIREBASE_STORAGE_EMULATOR_HOST), "storage emulator only");
const project = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "";
assert.equal(project, "demo-tpk");
assert.notEqual(project, "tpk-group-8cdc8");
delete process.env.FIREBASE_SERVICE_ACCOUNT;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
process.env.FIREBASE_PROJECT_ID = "demo-tpk";
process.env.FIREBASE_STORAGE_BUCKET = "demo-tpk.appspot.com";

const { adminDb, adminBucket } = await import("../../lib/firebase-admin.ts");
const db = adminDb();
const bucket = adminBucket();
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const [storageHostname, storagePort] = storageHost.split(":");

await fetch(`http://${firestoreHost}/emulator/v1/projects/demo-tpk/databases/(default)/documents`, { method: "DELETE" });
await fetch(`http://${authHost}/emulator/v1/projects/demo-tpk/accounts`, { method: "DELETE" });

async function signup(email) {
  const res = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "pw123456", returnSecureToken: true }),
  });
  const body = await res.json();
  assert.equal(res.ok, true, "signup failed");
  return body.localId;
}

const memberUid = await signup("member@example.com");
const ownerUid = await signup("owner@example.com");
const strangerUid = await signup("stranger@example.com");

await db.doc("campaigns/frostmaiden").set({ name: "Rime", ownerUid, status: "active" });
await db.doc(`campaigns/frostmaiden/members/${memberUid}`).set({ uid: memberUid, role: "member", email: "member@example.com" });
await db.doc("campaigns/other").set({ name: "Other", ownerUid: strangerUid, status: "active" });
await db.doc(`campaigns/other/members/${strangerUid}`).set({ uid: strangerUid, role: "organizer", email: "stranger@example.com" });
await bucket.file("recaps/avatars/frostmaiden_Ryn.png").save(Buffer.from("ryn-face"), { contentType: "image/png" });
await bucket.file("recaps/avatars/other_Face.png").save(Buffer.from("other-face"), { contentType: "image/png" });

const app = initializeApp({
  apiKey: "demo",
  authDomain: "demo-tpk.firebaseapp.com",
  projectId: "demo-tpk",
  storageBucket: "demo-tpk.appspot.com",
}, "avatar-rules");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
const storage = getStorage(app);
connectStorageEmulator(storage, storageHostname, Number(storagePort));

const portrait = ref(storage, "recaps/avatars/frostmaiden_Ryn.png");

async function asUser(email) {
  await signInWithEmailAndPassword(auth, email, "pw123456");
}
async function fails(promise) {
  try {
    await promise;
    return false;
  } catch (error) {
    assert.equal(error.code, "storage/unauthorized");
    return true;
  }
}

await asUser("member@example.com");
const bytes = await getBytes(portrait);
assert.equal(Buffer.from(bytes).toString(), "ryn-face");
const url = await getDownloadURL(portrait);
assert.match(url, /frostmaiden_Ryn\.png/);
await uploadString(ref(storage, "recaps/avatars/frostmaiden_New.png"), "new-face", "raw", { contentType: "image/png" });
assert.equal(await fails(getBytes(ref(storage, "recaps/avatars/other_Face.png"))), true);

await asUser("owner@example.com");
assert.equal(Buffer.from(await getBytes(portrait)).toString(), "ryn-face");

await asUser("stranger@example.com");
assert.equal(await fails(getBytes(portrait)), true);
assert.equal(await fails(uploadString(ref(storage, "recaps/avatars/frostmaiden_Hijack.png"), "nope", "raw", { contentType: "image/png" })), true);

await signOut(auth);
assert.equal(await fails(getBytes(portrait)), true);

console.log("storage avatar rules: ok");
