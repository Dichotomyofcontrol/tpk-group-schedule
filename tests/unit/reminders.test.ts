import { test } from "node:test";
import assert from "node:assert/strict";
import { dueReminder, reminderText } from "../../lib/reminders";
import type { Campaign, Session } from "../../lib/types";

const campaign = { id: "c", name: "Emberfall", requireRsvps: false, cadence: null, tz: "America/Los_Angeles" } as unknown as Campaign;
const base = { id: "s", cid: "c", startsAt: "2026-11-07T02:30:00.000Z", endsAt: "2026-11-07T06:30:00.000Z", tz: "America/Los_Angeles", title: "", location: "TPK Brewing", status: "scheduled", requireRsvps: null, seq: 0, attendance: [] } as unknown as Session;

test("reminder text includes the note for the table when set", () => {
  const text = reminderText(campaign, { ...base, notes: "Bring your sheets." } as Session, []);
  assert.match(text, /Note for the table: Bring your sheets\./);
});

test("reminder text omits the note line when empty", () => {
  assert.doesNotMatch(reminderText(campaign, base, []), /Note for the table/);
});

test("3h reminder is due inside its window only", () => {
  assert.equal(dueReminder(base, new Date("2026-11-06T23:45:00.000Z")), "3h");
  assert.equal(dueReminder(base, new Date("2026-11-06T20:00:00.000Z")), null);
});
