import { createSign } from "node:crypto";
import { connect, type ClientHttp2Session } from "node:http2";

/** APNs sender (token auth). Needs APNS_KEY_ID, APNS_KEY_P8 (the .p8 text) and APPLE_TEAM_ID. */
export type ApnsConfig = { keyId: string; teamId: string; key: string; bundleId: string; host: string };
export type PushPayload = { title: string; body: string; url?: string; badge?: number };
export type ApnsResult = { token: string; status: number; reason?: string };

export function apnsConfig(env: NodeJS.ProcessEnv = process.env): ApnsConfig | null {
  const keyId = env.APNS_KEY_ID, teamId = env.APPLE_TEAM_ID, raw = env.APNS_KEY_P8;
  if (!keyId || !teamId || !raw) return null;
  let key = raw.replace(/\\n/g, "\n").trim();
  if (!key.includes("BEGIN")) key = `-----BEGIN PRIVATE KEY-----\n${key.replace(/\s+/g, "").match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
  const host = env.APNS_SANDBOX === "1" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  return { keyId, teamId, key, bundleId: env.TAVERNING_BUNDLE_ID || "com.taverning.app", host };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** ES256 provider token. Apple accepts one for up to an hour; we mint per batch. */
export function apnsJwt(cfg: Pick<ApnsConfig, "keyId" | "teamId" | "key">, nowSec = Math.floor(Date.now() / 1000)): string {
  const head = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat: nowSec }));
  const sig = createSign("SHA256").update(`${head}.${claims}`).sign({ key: cfg.key, dsaEncoding: "ieee-p1363" });
  return `${head}.${claims}.${b64url(sig)}`;
}

export function apnsBody(p: PushPayload): string {
  return JSON.stringify({ aps: { alert: { title: p.title, body: p.body }, sound: "default", ...(p.badge != null ? { badge: p.badge } : {}) }, ...(p.url ? { url: p.url } : {}) });
}

export type Transport = (token: string, headers: Record<string, string>, body: string) => Promise<{ status: number; body: string }>;

function http2Transport(host: string): { send: Transport; close: () => void } {
  let session: ClientHttp2Session | null = null;
  const open = () => (session && !session.closed ? session : (session = connect(host)));
  const send: Transport = (token, headers, body) => new Promise((resolve, reject) => {
    const req = open().request({ ":method": "POST", ":path": `/3/device/${token}`, ...headers });
    let status = 0, data = "";
    req.on("response", (h) => { status = Number(h[":status"]); });
    req.setEncoding("utf8");
    req.on("data", (c) => { data += c; });
    req.on("end", () => resolve({ status, body: data }));
    req.on("error", reject);
    req.end(body);
  });
  return { send, close: () => session?.close() };
}

/** Sends one notification to each token. 410 / BadDeviceToken results tell the caller to drop the token. */
export async function sendApns(tokens: string[], payload: PushPayload, cfg: ApnsConfig, transport?: Transport): Promise<ApnsResult[]> {
  const own = transport ? null : http2Transport(cfg.host);
  const send = transport || own!.send;
  const headers = { authorization: `bearer ${apnsJwt(cfg)}`, "apns-topic": cfg.bundleId, "apns-push-type": "alert", "content-type": "application/json" };
  const body = apnsBody(payload);
  const out: ApnsResult[] = [];
  try {
    for (const token of tokens) {
      try {
        const res = await send(token, headers, body);
        let reason: string | undefined;
        try { reason = res.body ? (JSON.parse(res.body) as { reason?: string }).reason : undefined; } catch { /* empty body on 200 */ }
        out.push({ token, status: res.status, reason });
      } catch (error) {
        out.push({ token, status: 0, reason: error instanceof Error ? error.message : "network" });
      }
    }
  } finally { own?.close(); }
  return out;
}

export const deadToken = (r: ApnsResult) => r.status === 410 || r.reason === "BadDeviceToken" || r.reason === "Unregistered";
