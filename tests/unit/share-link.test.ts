import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linkCount, linkShareData, pollReminderMessage } from "../../lib/share-link.ts";

const url = "https://www.sixinthetpk.com/join/abc123";

test("a share sheet gets the link once, even when the old message already included it", () => {
  const seat = linkShareData("Seat for Greg", url, `Claim your seat as Greg: ${url}`);
  assert.deepEqual(seat, { title: "Seat for Greg", text: "Claim your seat as Greg", url });
  assert.equal(linkCount(seat), 1);

  const poll = linkShareData("Which night works?", url, `Pick every date that works for Saltmarsh: ${url}`);
  assert.equal(poll.text, "Pick every date that works for Saltmarsh");
  assert.equal(linkCount(poll), 1);

  const bare = linkShareData("Seat for Greg", url);
  assert.deepEqual(bare, { title: "Seat for Greg", url });
  assert.equal("text" in bare, false);
  assert.equal(linkCount(bare), 1);

  const nudge = linkShareData("Which night works?", url, "Mira: we're picking the next Saltmarsh night. Tap the dates that work for you.");
  assert.equal(nudge.text, "Mira: we're picking the next Saltmarsh night. Tap the dates that work for you.");
  assert.equal(linkCount(nudge), 1);
});

test("share and copy no longer hand the sheet both text-with-url and url", () => {
  const poll = readFileSync(new URL("../../components/poll-view.tsx", import.meta.url), "utf8");
  const roster = readFileSync(new URL("../../components/roster-card.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../../components/shell.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../../app/almanac.css", import.meta.url), "utf8");
  assert.match(poll, /navigator\.share\(linkShareData\(/);
  assert.doesNotMatch(poll, /navigator\.share\(\{\s*title,\s*text,\s*url\s*\}\)/);
  assert.match(poll, /writeText\(copyValue\)/);
  assert.doesNotMatch(roster, /\$\{url\}/);
  assert.doesNotMatch(poll, /works for \$\{[^}]+\}\: \$\{url\}/);
  assert.match(poll, /Share reminder/);
  assert.match(poll, /className="btn sec sm remind"/);
  assert.doesNotMatch(poll, /store\.nudge\(/);
  assert.doesNotMatch(poll, /who haven't voted/);
  assert.doesNotMatch(shell, /Skip to content/);
  assert.doesNotMatch(shell, /className="skip"/);
  assert.doesNotMatch(css, /\.skip\b/);
});

test("a poll reminder names who hasn't voted and includes the link once", () => {
  const url = "https://taverning.com/p/saltmarsh/salt-dates";
  const text = pollReminderMessage(["Elara", "Corin"], "Ghosts of Saltmarsh", url);
  assert.equal(text, `Elara and Corin: we're picking the next Ghosts of Saltmarsh night. Tap the dates that work for you: ${url}`);
  assert.equal(pollReminderMessage(["Elara"], "Ghosts of Saltmarsh", url), `Elara: we're picking the next Ghosts of Saltmarsh night. Tap the dates that work for you: ${url}`);
  const shared = linkShareData("Options?", url, text);
  assert.equal(shared.text, "Elara and Corin: we're picking the next Ghosts of Saltmarsh night. Tap the dates that work for you");
  assert.equal(shared.url, url);
  assert.equal(linkCount(shared), 1);
});

import { lockedDateMessage } from "../../lib/share-link";
test("locked date message is short and plain", () => {
  const m = lockedDateMessage({ campaignName: "Ghosts of Saltmarsh", startsAt: "2026-11-21T19:00:00.000Z", endsAt: "2026-11-21T23:00:00.000Z", tz: "America/Los_Angeles", location: "TPK Brewing", url: "https://taverning.com/p/x" });
  assert.equal(m, "Ghosts of Saltmarsh is on: Saturday, Nov 21, 11 AM–3 PM\nWhere: TPK Brewing\nhttps://taverning.com/p/x");
  assert.ok(!lockedDateMessage({ campaignName: "A", startsAt: "2026-11-21T19:00:00.000Z", tz: "UTC", url: "u" }).includes("Where"));
});
