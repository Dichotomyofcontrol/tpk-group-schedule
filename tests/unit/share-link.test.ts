import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linkCount, linkShareData } from "../../lib/share-link.ts";

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
  assert.match(poll, /navigator\.share\(linkShareData\(/);
  assert.doesNotMatch(poll, /navigator\.share\(\{\s*title,\s*text,\s*url\s*\}\)/);
  assert.match(poll, /writeText\(copyValue\)/);
  assert.doesNotMatch(roster, /\$\{url\}/);
  assert.doesNotMatch(poll, /works for \$\{[^}]+\}\: \$\{url\}/);
});
