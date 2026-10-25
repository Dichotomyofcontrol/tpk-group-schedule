import { FieldValue } from "firebase-admin/firestore";
import { adminConfigured, adminDb } from "@/lib/firebase-admin";
import { parsePreviouslyOn, publishPreviouslyOn } from "@/lib/previously-on";
import { firebaseRecapDeps } from "@/lib/recap-import";
import { secretOk } from "@/lib/tpk-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const deny = () => Response.json({ error: "Unauthorized." }, { status: 401 });

/**
 * POST /api/import/previously-on
 * Authorization: Bearer $TPK_IMPORT_SECRET  (same secret as POST /api/import/recap)
 *
 * Body:
 *   cid            campaign id
 *   date           local America/Los_Angeles play date, YYYY-MM-DD
 *   previouslyOn   markdown opener for that night. Empty clears it.
 *   dryRun?        resolve the session and return it without writing
 *
 * Matches the scheduled session whose startsAt falls on that LA date.
 * Zero or several matches is 409. This does not create a session and does
 * not require a recap PDF, so an automation can push the opener the day of the game.
 */
export async function POST(request: Request) {
  if (!secretOk(request)) return deny();
  if (!adminConfigured()) return Response.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  const len = Number(request.headers.get("content-length") || 0);
  if (len > 40_000) return Response.json({ error: "That opener is too long." }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Send JSON." }, { status: 400 }); }
  const parsed = parsePreviouslyOn(body);
  if (!parsed.ok) return Response.json(parsed.body, { status: parsed.status });
  try {
    const base = firebaseRecapDeps(adminDb(), { file: () => { throw new Error("unused"); } });
    const result = await publishPreviouslyOn({
      loadCampaign: base.loadCampaign,
      loadSessions: base.loadSessions,
      async mergeSession(cid, sid, data) {
        await base.mergeSession(cid, sid, {
          previouslyOn: data.previouslyOn === null ? FieldValue.delete() : data.previouslyOn,
        });
      },
    }, parsed.value);
    return Response.json(result.body, { status: result.status });
  } catch {
    return Response.json({ error: "Couldn't save that opener." }, { status: 500 });
  }
}
