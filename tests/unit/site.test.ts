import { test } from "node:test";
import assert from "node:assert/strict";
import { LEGACY_HOSTS, SITE_ORIGIN, legacyHostRedirects } from "../../lib/site.ts";

test("legacy hosts 308 to taverning.com and keep the path", () => {
  const rules = legacyHostRedirects();
  assert.equal(rules.length, LEGACY_HOSTS.length * 2);
  for (const host of LEGACY_HOSTS) {
    const root = rules.find((rule) => rule.has[0].value === host && rule.source === "/");
    const rest = rules.find((rule) => rule.has[0].value === host && rule.source === "/:path*");
    assert.ok(root);
    assert.ok(rest);
    assert.equal(root.permanent, true);
    assert.equal(rest.permanent, true);
    assert.equal(root.destination, `${SITE_ORIGIN}/`);
    assert.equal(rest.destination, `${SITE_ORIGIN}/:path*`);
    assert.equal(root.has[0].type, "host");
  }
  assert.equal(SITE_ORIGIN, "https://taverning.com");
});
