import { adminConfigured, adminDb } from "@/lib/firebase-admin";
import { hit } from "@/lib/rate-limit";
import { redeemSignInCode } from "@/lib/sign-in-code-store";
import { parseSignInCode } from "@/lib/sign-in-code";
import { normalizeEmail } from "@/lib/signin-email";

export const dynamic = "force-dynamic";

const INVALID = () => Response.json({ error: "That code didn't work. Check it, or request a new email." }, { status: 400 });

/** Redeems the 6-digit code from the sign-in email. The code is single-use and expires in 15 minutes. */
export async function POST(request: Request) {
  let body: { email?: unknown; code?: unknown } = {};
  try { body = await request.json(); } catch { /* fall through */ }
  const email = normalizeEmail(body.email);
  const code = parseSignInCode(body.code);
  if (!email || !code) return INVALID();
  if (!adminConfigured()) return Response.json({ error: "Email sign-in isn't configured on this deploy." }, { status: 503 });

  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0]!.trim() || "unknown";
  let db = null;
  try { db = adminDb(); } catch { db = null; }
  const tenMin = 10 * 60 * 1000;
  const [emailOk, ipOk] = await Promise.all([
    hit(db, `code-email:${email}`, 8, tenMin),
    hit(db, `code-ip:${ip}`, 30, tenMin),
  ]);
  if (!emailOk || !ipOk) {
    return Response.json({ error: "Too many tries. Wait a few minutes and request a new email." }, { status: 429 });
  }
  if (!db) return Response.json({ error: "Email sign-in isn't configured on this deploy." }, { status: 503 });

  try {
    const result = await redeemSignInCode(db, email, code);
    if (!result.ok) {
      const error = result.error === "expired"
        ? "That code expired. Request a new email."
        : "That code didn't work. Check it, or request a new email.";
      return Response.json({ error }, { status: 400 });
    }
    return Response.json({ link: result.link });
  } catch (error) {
    console.error("sign-in code redeem failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Couldn't check that code. Try again." }, { status: 502 });
  }
}
