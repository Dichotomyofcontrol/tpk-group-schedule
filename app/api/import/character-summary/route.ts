import { adminConfigured, adminDb } from "@/lib/firebase-admin";
import { parseSummaryWrite, readySummary, summaryDocId } from "@/lib/character-summary";
import { secretOk } from "@/lib/tpk-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const deny = () => Response.json({ error: "Unauthorized." }, { status: 401 });

/**
 * POST /api/import/character-summary
 * Authorization: Bearer $TPK_IMPORT_SECRET
 *
 * The Archivist writes a stored summary. This route does not call an AI API.
 *
 * Body:
 *   cid    campaign id
 *   name   character name
 *   text   three or four sentences
 *   facts  { class, ancestry, role, moment }
 *
 * Writes campaigns/{cid}/characterSummaries/{slug} with status "ready".
 * A client cannot update that doc. Publishing the rule is:
 *   firebase use tpk-group-8cdc8 && firebase deploy --only firestore:rules
 */
export async function POST(request: Request) {
  if (!secretOk(request)) return deny();
  if (!adminConfigured()) return Response.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  const len = Number(request.headers.get("content-length") || 0);
  if (len > 20_000) return Response.json({ error: "That summary is too long." }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Send JSON." }, { status: 400 }); }
  const parsed = parseSummaryWrite(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });
  const summary = readySummary(parsed.value);
  try {
    await adminDb()
      .collection("campaigns")
      .doc(parsed.value.cid)
      .collection("characterSummaries")
      .doc(summaryDocId(summary.name))
      .set(summary);
    return Response.json({ ok: true, id: summaryDocId(summary.name), status: summary.status });
  } catch {
    return Response.json({ error: "Couldn't save that summary." }, { status: 500 });
  }
}
