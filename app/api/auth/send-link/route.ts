import { getAuth } from "firebase-admin/auth";
import { adminApp, adminConfigured, adminDb } from "@/lib/firebase-admin";
import { magicLinkContinueUrl } from "@/lib/magic-link";
import { hit } from "@/lib/rate-limit";
import { deleteSignInCode, saveSignInCode } from "@/lib/sign-in-code-store";
import { generateSignInCode } from "@/lib/sign-in-code";
import { brandedSignInLink, normalizeEmail, safeOrigin } from "@/lib/signin-email";
import { emailFromAddress, sendViaResend } from "@/lib/send-link";

export const dynamic = "force-dynamic";

const OK = () => Response.json({ ok: true });

/** Sends the branded sign-in email. Always answers with a generic OK so it can't be used to probe accounts. */
export async function POST(request: Request) {
  let body: { email?: unknown; invite?: unknown; seat?: unknown } = {};
  try { body = await request.json(); } catch { /* fall through */ }
  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: "Enter a valid email." }, { status: 400 });
  const invite = typeof body.invite === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(body.invite) ? body.invite : undefined;
  const seat = typeof body.seat === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(body.seat) ? body.seat : undefined;

  if (!adminConfigured()) {
    console.error("send-link: refusing Firebase fallback because FIREBASE_SERVICE_ACCOUNT is not set");
    return Response.json({ error: "Email sign-in isn't configured on this deploy." }, { status: 503 });
  }
  if (!process.env.RESEND_API_KEY) {
    console.error("send-link: refusing Firebase fallback because RESEND_API_KEY is not set");
    return Response.json({ error: "Email sign-in isn't configured on this deploy." }, { status: 503 });
  }

  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0]!.trim() || "unknown";
  let db = null;
  try { db = adminDb(); } catch { db = null; }
  const tenMin = 10 * 60 * 1000;
  const [emailOk, ipOk] = await Promise.all([
    hit(db, `email:${email}`, 3, tenMin),
    hit(db, `ip:${ip}`, 10, tenMin),
  ]);
  if (!emailOk || !ipOk) return OK();
  // Each new link invalidates the previous one. A double tap would leave the first email
  // (the one people open) dead, so send at most one link per address per minute.
  if (!(await hit(db, `recent:${email}`, 1, 60 * 1000))) return OK();

  const origin = safeOrigin(request.headers.get("origin") || new URL(request.url).origin);
  const continueUrl = magicLinkContinueUrl(origin, invite, seat);
  let raw: string;
  try {
    raw = await getAuth(adminApp()).generateSignInWithEmailLink(email, { url: continueUrl, handleCodeInApp: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(`send-link: refusing Firebase fallback because generateSignInWithEmailLink failed (${continueUrl}): ${message}`);
    return Response.json({ error: "Couldn't send the sign-in email. Try again." }, { status: 502 });
  }
  const code = generateSignInCode();
  const link = brandedSignInLink(raw, continueUrl);
  if (!db) {
    console.error("send-link: refusing Firebase fallback because Firestore admin is unavailable");
    return Response.json({ error: "Couldn't send the sign-in email. Try again." }, { status: 502 });
  }
  try {
    await saveSignInCode(db, email, code, link);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(`send-link: refusing Firebase fallback because the code could not be stored: ${message}`);
    return Response.json({ error: "Couldn't send the sign-in email. Try again." }, { status: 502 });
  }
  const sent = await sendViaResend(email, link, code);
  if (!sent.ok) {
    await deleteSignInCode(db, email).catch(() => undefined);
    console.error(`send-link: refusing Firebase fallback (Resend ${sent.status}, from ${emailFromAddress()}): ${sent.reason}`);
    return Response.json({ error: "Couldn't send the sign-in email. Try again." }, { status: 502 });
  }
  return OK();
}
