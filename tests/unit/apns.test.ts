import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { apnsBody, apnsConfig, apnsJwt, deadToken, sendApns } from "../../lib/apns";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

test("apnsConfig is null until all three APNs values exist", () => {
  assert.equal(apnsConfig({ APNS_KEY_ID: "K" }), null);
  const cfg = apnsConfig({ APNS_KEY_ID: "K", APPLE_TEAM_ID: "T", APNS_KEY_P8: pem });
  assert.equal(cfg?.bundleId, "com.taverning.app");
  assert.equal(cfg?.host, "https://api.push.apple.com");
});

test("bare base64 key body is wrapped as PEM", () => {
  const body = pem.split("\n").filter((l) => l && !l.startsWith("-----")).join("");
  const cfg = apnsConfig({ APNS_KEY_ID: "K", APPLE_TEAM_ID: "T", APNS_KEY_P8: body })!;
  assert.match(cfg.key, /^-----BEGIN PRIVATE KEY-----\n/);
  assert.ok(apnsJwt(cfg));
});

test("JWT is ES256 with kid/iss and verifies", () => {
  const jwt = apnsJwt({ keyId: "ABC123", teamId: "TEAM", key: pem }, 1000);
  const [h, c, s] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { alg: "ES256", kid: "ABC123" });
  assert.deepEqual(JSON.parse(Buffer.from(c, "base64url").toString()), { iss: "TEAM", iat: 1000 });
  const ok = createVerify("SHA256").update(`${h}.${c}`).verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
  assert.ok(ok);
});

test("payload carries alert and deep-link url", () => {
  assert.deepEqual(JSON.parse(apnsBody({ title: "T", body: "B", url: "/sessions/x" })), { aps: { alert: { title: "T", body: "B" }, sound: "default" }, url: "/sessions/x" });
});

test("sendApns uses topic and flags dead tokens", async () => {
  const cfg = apnsConfig({ APNS_KEY_ID: "K", APPLE_TEAM_ID: "T", APNS_KEY_P8: pem })!;
  const seen: Record<string, string>[] = [];
  const res = await sendApns(["good", "gone"], { title: "a", body: "b" }, cfg, async (token, headers) => {
    seen.push(headers);
    return token === "good" ? { status: 200, body: "" } : { status: 410, body: '{"reason":"Unregistered"}' };
  });
  assert.equal(seen[0]["apns-topic"], "com.taverning.app");
  assert.equal(seen[0]["apns-push-type"], "alert");
  assert.deepEqual(res.map(deadToken), [false, true]);
});
