import { getAuth } from "firebase-admin/auth";
import { adminApp, adminConfigured, adminDb } from "@/lib/firebase-admin";
import { magicLinkContinueUrl } from "@/lib/magic-link";
import { hit } from "@/lib/rate-limit";
import { brandedSignInLink, normalizeEmail, safeOrigin } from "@/lib/signin-email";
import { sendViaResend } from "@/lib/send-link";

export const dynamic = "force-dynamic";

const OK = () => Response.json({ ok: true });

/** Sends the branded sign-in email. Always answers with a generic OK so it can't be used to probe accounts. */
export async function POST(request: Request) {
  let body: { email?: unknown; invite?: unknown } = {};
  try { body = await request.json(); } catch { /* fall through */ }
  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: "Enter a valid email." }, { status: 400 });
  const invite = typeof body.invite === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(body.invite) ? body.invite : undefined;

  if (!adminConfigured() || !process.env.RESEND_API_KEY) {
    console.error("send-link: missing FIREBASE_SERVICE_ACCOUNT or RESEND_API_KEY");
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

  try {
    const origin = safeOrigin(request.headers.get("origin") || new URL(request.url).origin);
    const continueUrl = magicLinkContinueUrl(origin, invite);
    const raw = await getAuth(adminApp()).generateSignInWithEmailLink(email, { url: continueUrl, handleCodeInApp: true });
    const sent = await sendViaResend(email, brandedSignInLink(raw, continueUrl));
    if (!sent) console.error("send-link: Resend rejected the message");
  } catch (error) {
    console.error("send-link failed", error instanceof Error ? error.message : "unknown");
  }
  return OK();
}
