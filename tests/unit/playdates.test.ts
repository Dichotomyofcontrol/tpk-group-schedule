import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { attendanceState, headcountLabel } from "../../lib/attendance.ts";
import { contrastRatio, textOn } from "../../lib/color.ts";
import { buildDemo } from "../../lib/demo-data.ts";
import { demoFeed } from "../../lib/calendar-feed.ts";
import { buildIcs } from "../../lib/ics.ts";
import { sampleLegacyExport } from "../../lib/legacy-fixture.ts";
import { formatDryRun, planMigration } from "../../lib/migrate.ts";
import { applyCadence, lockPoll, saveRecap, skipSession, upcomingSessions } from "../../lib/model.ts";
import { markdownToHtml } from "../../lib/recap.ts";
import { cadenceDates } from "../../lib/recurrence.ts";
import { dueReminder } from "../../lib/reminders.ts";
import { zonedTimeToUtc } from "../../lib/time.ts";
import type { Campaign, Session } from "../../lib/types.ts";

test("Pacific wall time converts to the right UTC instant across the 2026 DST change", () => {
  const pdt = zonedTimeToUtc("2026-10-23", "18:30", "America/Los_Angeles");
  assert.equal(pdt.toISOString(), "2026-10-24T01:30:00.000Z");
  const pst = zonedTimeToUtc("2026-11-06", "18:30", "America/Los_Angeles");
  assert.equal(pst.toISOString(), "2026-11-07T02:30:00.000Z");
});

test("skipping one Friday does not move the next", () => {
  const dates = cadenceDates(
    { interval: 2, weekday: 5, startTime: "18:30", durationMin: 240, tz: "America/Los_Angeles", anchorDate: "2026-10-23" },
    "2026-10-01",
    "2026-12-31",
  );
  assert.deepEqual(dates.slice(0, 4), ["2026-10-09", "2026-10-23", "2026-11-06", "2026-11-20"]);
  const state = buildDemo("seth");
  const target = state.sessions.find((session) => session.cid === "strahd" && session.occurrenceKey === "2026-11-06");
  assert.ok(target);
  const next = skipSession(state, target.id);
  const skipped = next.sessions.find((session) => session.id === target.id);
  const following = next.sessions.find((session) => session.cid === "strahd" && session.occurrenceKey === "2026-11-20");
  assert.equal(skipped?.status, "cancelled");
  assert.equal(skipped?.exception, "skip");
  assert.equal(following?.status, "scheduled");
  assert.equal(following?.startsAt, state.sessions.find((session) => session.id === following?.id)?.startsAt);
});

test("everyone is in until they tap can't make it", () => {
  const state = buildDemo("giada");
  const campaign = state.campaigns.find((item) => item.id === "strahd")!;
  const session = state.sessions.find((item) => item.cid === "strahd" && item.occurrenceKey === "2026-10-23")!;
  assert.equal(campaign.requireRsvps, false);
  assert.equal(attendanceState(campaign, session, "giada"), "in");
  assert.equal(attendanceState(campaign, session, "kai"), "out");
  assert.match(headcountLabel(campaign, session, state.members.strahd), /5 of 6 in/);
  assert.equal(state.campaigns.find((item) => item.id === "strahd")?.color, "#ef5350");
  assert.equal(state.campaigns.find((item) => item.id === "frostmaiden")?.color, "#4fc3f7");
  assert.equal(state.me.canCreateCampaigns, false);
  assert.equal(buildDemo("seth").me.canCreateCampaigns, true);
  const visible = upcomingSessions(state).map((item) => item.cid);
  assert.equal(visible.includes("beerovia"), false);
  assert.ok(state.invites.some((invite) => invite.token === "beerovia-demo"));
});

test("campaign colours stay readable on their tiles", () => {
  for (const color of ["#ef5350", "#4fc3f7", "#f5c518", "#4caf50", "#ff9800", "#ce93d8"]) {
    assert.ok(contrastRatio(color, textOn(color)) >= 4.5, color);
  }
});

test("migration keeps colours, maps roles, and stores UTC", () => {
  const plan = planMigration(sampleLegacyExport());
  const strahd = plan.campaigns.find((campaign) => campaign.id === "strahd")!;
  assert.equal(strahd.color, "#ef5350");
  assert.equal(strahd.icon, "🧛");
  const members = plan.members.filter((member) => member.cid === "strahd");
  assert.equal(members.find((member) => member.email === "sthomas131@gmail.com")?.role, "organizer");
  assert.ok(members.find((member) => member.email === "sthomas131@gmail.com")?.tags.includes("dm"));
  assert.equal(members.find((member) => member.email === "amy@example.com")?.role, "coorganizer");
  assert.equal(members.find((member) => member.email === "sam@example.com")?.role, "member");
  assert.equal(members.find((member) => member.email === "ben@example.com")?.tags.includes("dm"), true);
  assert.equal(members.find((member) => member.email === "ben@example.com")?.role, "member");
  const session = plan.sessions.find((item) => item.cid === "strahd" && item.occurrenceKey === "2026-10-23");
  assert.equal(session?.startsAt, "2026-10-24T01:00:00.000Z");
  assert.match(formatDryRun(plan, "fixture"), /No writes/);
  assert.equal(plan.campaigns.every((campaign) => campaign.cadence === null), true);
});

test("ics feed marks a skip as cancelled and keeps the viewer who is out", () => {
  const feed = demoFeed("demo-giada", "strahd");
  assert.ok(feed);
  assert.match(feed!, /BEGIN:VCALENDAR/);
  assert.match(feed!, /STATUS:CANCELLED/);
  assert.doesNotMatch(feed!, /Beerovia/);
  const session = {
    id: "s1",
    cid: "strahd",
    startsAt: "2026-10-24T01:30:00.000Z",
    endsAt: "2026-10-24T05:30:00.000Z",
    tz: "America/Los_Angeles",
    title: "Session",
    location: "TPK",
    status: "cancelled",
    requireRsvps: null,
    seq: 3,
    attendance: [],
  } satisfies Session;
  const campaign = { id: "strahd", name: "Curse of Strahd", color: "#ef5350" } as Campaign;
  const ics = buildIcs("Test", [{ session, campaign, viewerOut: true }]);
  assert.match(ics, /Out · Curse of Strahd/);
  assert.match(ics, /SEQUENCE:3/);
  assert.match(ics, /STATUS:CANCELLED/);
});

test("reminders are due 3 days and 3 hours before, once", () => {
  const startsAt = "2026-10-23T18:30:00.000Z";
  const session = {
    id: "s",
    cid: "strahd",
    startsAt,
    endsAt: startsAt,
    tz: "America/Los_Angeles",
    title: "Session",
    location: "",
    status: "scheduled",
    requireRsvps: null,
    seq: 0,
    attendance: [],
  } satisfies Session;
  assert.equal(dueReminder(session, new Date("2026-10-20T18:30:00.000Z")), "3d");
  assert.equal(dueReminder(session, new Date("2026-10-23T15:30:00.000Z")), "3h");
  assert.equal(dueReminder({ ...session, reminder3dSent: true }, new Date("2026-10-20T18:30:00.000Z")), null);
  assert.equal(dueReminder({ ...session, status: "cancelled" }, new Date("2026-10-20T18:30:00.000Z")), null);
});

test("locking a poll creates one session and does not invent quorum", () => {
  const state = buildDemo("seth");
  const poll = state.polls[0]!;
  const best = "2026-12-07-18:00";
  const next = lockPoll(state, poll.id, best);
  assert.ok(!("error" in next));
  if ("error" in next) return;
  assert.equal(next.polls[0]?.status, "locked");
  assert.ok(next.sessions.some((session) => session.id === "frostmaiden-poll-2026-12-07-18:00"));
  const rules = readFileSync(new URL("../../firebase/firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /allowMemberInvites|isOrganizer/);
  assert.match(rules, /coorganizer/);
  assert.doesNotMatch(rules, /quorum/i);
});

test("re-saving a cadence attaches an existing date instead of duplicating it", () => {
  const state = buildDemo("seth");
  const before = state.sessions.filter((session) => session.cid === "strahd" && session.occurrenceKey === "2026-11-20");
  assert.equal(before.length, 1);
  const cadence = state.campaigns.find((campaign) => campaign.id === "strahd")!.cadence!;
  const next = applyCadence(state, "strahd", cadence, new Date("2026-10-20T12:00:00.000Z"));
  const after = next.sessions.filter((session) => session.cid === "strahd" && session.occurrenceKey === "2026-11-20");
  assert.equal(after.length, 1);
  assert.equal(after[0]?.location, "Seth's place");
});

test("migration keeps recap HTML and the original PDF storage path", () => {
  const plan = planMigration(sampleLegacyExport());
  const session = plan.sessions.find((item) => item.cid === "strahd" && item.occurrenceKey === "2026-10-09");
  assert.equal(session?.recapHtml, "<p>The vineyard burned, Ichabod kept the gem.</p>");
  assert.equal(session?.recapText, "The vineyard burned.");
  assert.equal(session?.pdfPath, "recaps/2026-10-09_Wizard_of_Wines.pdf");
  assert.equal(session?.pdfName, "Wizard of Wines.pdf");
  assert.equal(plan.recapFiles[0]?.file, "2026-10-09_Wizard_of_Wines.pdf");
  assert.equal(plan.recapFiles[0]?.cid, "strahd");
  assert.equal(plan.campaigns.find((campaign) => campaign.id === "strahd")?.previouslyOnSessionId, session?.id);
  const report = formatDryRun(plan, "fixture");
  assert.match(report, /PDFs carried: 1/);
  assert.match(report, /bytes are not copied/);
  assert.match(report, /recaps\/2026-10-09_Wizard_of_Wines\.pdf/);

  const tokenized = planMigration({
    campaigns: [{ id: "strahd", name: "Curse of Strahd", color: "#ef5350", icon: "🧛" }],
    sessions: [{
      id: "tok",
      campaign: "strahd",
      date: "2026-09-01",
      time: "6:00 PM",
      pdfUrl: "https://firebasestorage.googleapis.com/v0/b/tpk-group-8cdc8.firebasestorage.app/o/recaps%2F2026-09-01_notes.pdf?alt=media&token=secret",
    }],
  });
  assert.equal(tokenized.sessions[0]?.pdfPath, "recaps/2026-09-01_notes.pdf");
  assert.equal(tokenized.sessions[0]?.pdfUrl, undefined);
  assert.equal(tokenized.recapFiles[0]?.file, "2026-09-01_notes.pdf");

  const avatar = planMigration({
    campaigns: [{ id: "strahd", name: "Curse of Strahd", color: "#ef5350" }],
    sessions: [{ id: "av", campaign: "strahd", date: "2026-09-02", time: "6:00 PM", pdfUrl: "/recaps/avatars/seth.png" }],
  });
  assert.equal(avatar.recapFiles.length, 0);
  assert.equal(avatar.sessions[0]?.pdfPath, undefined);

  const storageRules = readFileSync(new URL("../../firebase/storage.rules", import.meta.url), "utf8");
  assert.match(storageRules, /isMember/);
  assert.match(storageRules, /application\/pdf/);
  assert.match(storageRules, /recapFiles/);
  assert.doesNotMatch(storageRules, /allow read: if true/);
  const firestoreRules = readFileSync(new URL("../../firebase/firestore.rules", import.meta.url), "utf8");
  assert.match(firestoreRules, /match \/recapFiles\/\{file\}/);
  assert.match(firestoreRules, /allow write: if false/);
  const nextConfig = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  assert.doesNotMatch(nextConfig, /firebasestorage/);
});

test("saving the latest recap refreshes Previously on and leaves older nights alone", () => {
  const state = buildDemo("seth");
  const older = state.sessions.find((session) => session.cid === "strahd" && session.occurrenceKey === "2026-09-25")!;
  const latest = state.sessions.find((session) => session.cid === "strahd" && session.occurrenceKey === "2026-10-09")!;
  const now = new Date("2026-10-20T12:00:00.000Z");
  const editedOld = saveRecap(state, older.id, { recapText: "A quieter beacon." }, now);
  assert.equal(editedOld.campaigns.find((campaign) => campaign.id === "strahd")?.previouslyOn, state.campaigns.find((campaign) => campaign.id === "strahd")?.previouslyOn);
  const edited = saveRecap(state, latest.id, { recapHtml: "<p>The vineyard <strong>burned</strong> again.</p>", recapText: "The vineyard burned again." }, now);
  assert.equal(edited.campaigns.find((campaign) => campaign.id === "strahd")?.previouslyOn, "The vineyard burned again.");
  assert.equal(edited.campaigns.find((campaign) => campaign.id === "strahd")?.previouslyOnSessionId, latest.id);
  assert.equal(edited.sessions.find((session) => session.id === latest.id)?.exception, latest.exception);
  assert.match(markdownToHtml("## Title\n\nThe gem **stayed**."), /<h2>Title<\/h2><p>The gem <strong>stayed<\/strong>\.<\/p>/);
});
