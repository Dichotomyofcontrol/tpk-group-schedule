import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { sampleLegacyExport } from "../lib/legacy-fixture.ts";
import { formatDryRun, planMigration, type LegacyExport } from "../lib/migrate.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const yes = args.includes("--yes");
const dryRun = !apply || args.includes("--dry-run");
const fixtureFlag = args.indexOf("--fixture");
const zoneFlag = args.indexOf("--zone");
const zone = zoneFlag >= 0 ? args[zoneFlag + 1] : "America/Los_Angeles";

function loadFixture(): { data: LegacyExport; source: string } {
  if (fixtureFlag >= 0) {
    const path = resolve(args[fixtureFlag + 1]);
    return { data: JSON.parse(readFileSync(path, "utf8")) as LegacyExport, source: path };
  }
  return { data: sampleLegacyExport(), source: "built-in fixture (scripts read lib/legacy-fixture.ts). Live Firestore was not contacted." };
}

async function loadFirestore(): Promise<{ data: LegacyExport; source: string } | null> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) return null;
  const { adminDb } = await import("../lib/firebase-admin.ts");
  const db = adminDb();
  const campaignsSnap = await db.collection("campaigns").get();
  const sessionsSnap = await db.collection("sessions").get();
  const sharesSnap = await db.collection("shares").get();
  return {
    source: `firestore project ${process.env.FIREBASE_PROJECT_ID || "tpk-group-8cdc8"} (read-only${dryRun ? ", dry run" : ""})`,
    data: {
      campaigns: campaignsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      sessions: sessionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      shares: sharesSnap.docs.map((doc) => doc.data()),
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
  for (const campaign of plan.campaigns) {
    await db.collection("campaigns").doc(campaign.id).set(campaign, { merge: true });
  }
  for (const member of plan.members) {
    const { cid, ...rest } = member;
    await db.collection("campaigns").doc(cid).collection("members").doc(member.id).set(rest, { merge: true });
  }
  for (const session of plan.sessions) {
    const attendance: Record<string, unknown> = {};
    for (const row of session.attendance) attendance[row.uid] = row;
    await db.collection("campaigns").doc(session.cid).collection("sessions").doc(session.id).set({ ...session, attendance }, { merge: true });
  }
  for (const file of plan.recapFiles) {
    await db.collection("recapFiles").doc(file.file).set({
      cid: file.cid,
      sessionId: file.sessionId,
      path: file.path,
    }, { merge: true });
  }
  await db.collection("config").doc("allowlist").set({ emails: ["sthomas131@gmail.com"] }, { merge: true });
  await db.collection("creators").doc("sthomas131@gmail.com").set({ name: "Seth" }, { merge: true });
  console.log("Applied. Allow-list seeded with sthomas131@gmail.com. Old collections were left in place.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
