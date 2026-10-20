import { NextResponse, type NextRequest } from "next/server";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tpk-group-8cdc8";
const ALLOWED = (process.env.MALOREN_ALLOWED_EMAIL || "sthomas131@gmail.com").toLowerCase();
const JWK_URL = "https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com";

type FirebaseJwk = JsonWebKey & { kid?: string };

let jwksCache: FirebaseJwk[] | null = null;
let jwksExp = 0;

async function getKeys(): Promise<FirebaseJwk[]> {
  if (jwksCache && Date.now() < jwksExp) return jwksCache;
  const res = await fetch(JWK_URL);
  const data = await res.json() as { keys?: FirebaseJwk[] };
  jwksCache = data.keys || [];
  jwksExp = Date.now() + 3_600_000;
  return jwksCache;
}

function b64urlBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bin = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlJson(value: string): { kid?: string; exp?: number; iss?: string; aud?: string; email?: string } {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(value)));
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("__tpk_token")?.value;
  const deny = () => NextResponse.redirect(new URL("/signin?next=/maloren", req.url));
  if (!token) return deny();
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    const header = b64urlJson(headerB64);
    const payload = b64urlJson(payloadB64);
    const keys = await getKeys();
    const jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) return deny();
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(sigB64), signed);
    const now = Math.floor(Date.now() / 1000);
    if (!ok || (payload.exp && payload.exp < now)) return deny();
    if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return deny();
    if (payload.aud !== PROJECT_ID) return deny();
    if ((payload.email || "").toLowerCase() !== ALLOWED) return deny();
    return NextResponse.next();
  } catch {
    return deny();
  }
}

export const config = { matcher: ["/maloren", "/maloren/:path*", "/iven", "/iven/:path*"] };
