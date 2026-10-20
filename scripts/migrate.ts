import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { sampleLegacyExport } from "../lib/legacy-fixture.ts";
import { formatDryRun, normalizeLegacyExport, planMigration, type LegacyExport, type StorageObjectPlan } from "../lib/migrate.ts";
import { omitUndefined } from "../lib/omit.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const yes = args.includes("--yes");
const dryRun = !apply || args.includes("--dry-run");
const fixtureFlag = args.indexOf("--fixture");
const zoneFlag = args.indexOf("--zone");
const zone = zoneFlag >= 0 ? args[zoneFlag + 1] : "America/Los_Angeles";

const storageFlag = args.indexOf("--storage");

function loadFixture(): { data: LegacyExport; source: string } {
  if (fixtureFlag >= 0) {
    const path = resolve(args[fixtureFlag + 1]);
    return { data: normalizeLegacyExport(JSON.parse(readFileSync(path, "utf8"))), source: path };
  }
  return { data: sampleLegacyExport(), source: "built-in fixture (scripts read lib/legacy-fixture.ts). Live Firestore was not contacted." };
}

function loadStorage(path: string): StorageObjectPlan[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Storage manifest must be an array.");
  return parsed.map((item) => {
    if (typeof item === "string") return { name: item };
    const object = item as { name?: string; md5Hash?: string; contentType?: string; size?: string };
    if (!object.name) throw new Error("Storage manifest entry is missing name.");
    return { name: object.name, md5Hash: object.md5Hash, contentType: object.contentType, size: object.size };
  });
}

async function loadFirestore(): Promise<{ data: LegacyExport; source: string } | null> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) return null;
  const { adminDb } = await import("../lib/firebase-admin.ts");
  const db = adminDb();
  const [campaignsSnap, sessionsSnap, sharesSnap, charactersSnap, rostersSnap, codesSnap, configCharsSnap, configRostersSnap, ivenSnap] = await Promise.all([
    db.collection("campaigns").get(),
    db.collection("sessions").get(),
    db.collection("shares").get(),
    db.collection("characters").get(),
    db.collection("rosters").get(),
    db.collection("codes").get(),
    db.collection("config").doc("characters").get(),
    db.collection("config").doc("rosters").get(),
    db.collection("ivenHeroes").get(),
  ]);
  const characters: NonNullable<LegacyExport["characters"]> = {};
  for (const doc of charactersSnap.docs) {
    const chars = doc.data().chars;
    characters[doc.id] = chars && typeof chars === "object" ? chars as NonNullable<LegacyExport["characters"]>[string] : {};
  }
  const rosters: NonNullable<LegacyExport["rosters"]> = {};
  for (const doc of rostersSnap.docs) {
    const list = doc.data().list;
    rosters[doc.id] = Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];
  }
  const configCharacters = configCharsSnap.exists()
    ? configCharsSnap.data() as LegacyExport["configCharacters"]
    : undefined;
  const configRosterRaw = configRostersSnap.exists() ? configRostersSnap.data() ?? {} : undefined;
  const configRosters = configRosterRaw
    ? Object.fromEntries(Object.entries(configRosterRaw).map(([cid, list]) => [
      cid,
      Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [],
    ]))
    : undefined;
  return {
    source: `firestore project ${process.env.FIREBASE_PROJECT_ID || "tpk-group-8cdc8"} (read-only${dryRun ? ", dry run" : ""})`,
    data: {
      campaigns: campaignsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      sessions: sessionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      shares: sharesSnap.docs.map((doc) => doc.data()),
      characters,
      rosters,
      codes: codesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      configCharacters,
      configRosters,
      ivenHeroes: ivenSnap.docs.map((doc) => ({
        id: doc.id,
        updatedAt: typeof doc.data().updatedAt === "number" ? doc.data().updatedAt : undefined,
        heroesJson: typeof doc.data().heroesJson === "string" ? doc.data().heroesJson : undefined,
      })),
    },
  };
}

async function main() {
  const live = args.includes("--firestore");
  const loaded = live ? await loadFirestore() : null;
  if (live && !loaded) {
    console.error("No Firebase Admin credentials. Refusing to guess. Re-run without --firestore to dry-run the built-in fixture.");
    process.exit(1);
  }
  const { data, source } = loaded ?? loadFixture();
  if (storageFlag >= 0) data.storage = loadStorage(resolve(args[storageFlag + 1]));
  const plan = planMigration(data, zone);
  const report = formatDryRun(plan, source);
  console.log(report);
  mkdirSync("migration-out", { recursive: true });
  writeFileSync("migration-out/dry-run.txt", report);
  writeFileSync("migration-out/plan.json", JSON.stringify({
    campaigns: plan.campaigns,
    sessions: plan.sessions,
    members: plan.members,
    warnings: plan.warnings,
  }, null, 2));
  if (dryRun) {
    console.log("Dry run only. Pass --apply --yes with Admin credentials to write the new collections.");
    return;
  }
  if (!yes) {
    console.error("Refusing to write without --yes.");
    process.exit(1);
  }
  const { adminDb } = await import("../lib/firebase-admin.ts");
  const db = adminDb();
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Settings can only be applied once per Firestore instance.
  }
  for (const campaign of plan.campaigns) {
    await db.collection("campaigns").doc(campaign.id).set(omitUndefined(campaign), { merge: true });
  }
  for (const member of plan.members) {
    const { cid, ...rest } = member;
    await db.collection("campaigns").doc(cid).collection("members").doc(member.id).set(omitUndefined(rest), { merge: true });
  }
  for (const session of plan.sessions) {
    const attendance: Record<string, unknown> = {};
    for (const row of session.attendance) attendance[row.uid] = row;
    await db.collection("campaigns").doc(session.cid).collection("sessions").doc(session.id).set(omitUndefined({ ...session, attendance }), { merge: true });
  }
  for (const file of plan.recapFiles) {
    await db.collection("recapFiles").doc(file.file).set(omitUndefined({
      cid: file.cid,
      sessionId: file.sessionId,
      path: file.path,
    }), { merge: true });
  }
  await db.collection("config").doc("allowlist").set({ emails: ["sthomas131@gmail.com"] }, { merge: true });
  await db.collection("creators").doc("sthomas131@gmail.com").set({ name: "Seth" }, { merge: true });
  console.log("Applied. Allow-list seeded with sthomas131@gmail.com. Old collections were left in place.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
