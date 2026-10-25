import { adminBucket, adminConfigured, adminDb } from "@/lib/firebase-admin";
import { firebaseRecapDeps, parseRecapImport, publishRecap } from "@/lib/recap-import";
import { secretOk } from "@/lib/tpk-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const deny = () => Response.json({ error: "Unauthorized." }, { status: 401 });

/**
 * POST /api/import/recap
 * Authorization: Bearer $TPK_IMPORT_SECRET  (same secret as POST /api/import/tpk)
 *
 * Body:
 *   cid              campaign id (frostmaiden, strahd, ghosts-of-saltmarsh, …)
 *   date             local America/Los_Angeles play date, YYYY-MM-DD
 *   markdown         recap markdown (also accepted as recapMarkdown)
 *   filename         PDF file name (must end in .pdf)
 *   pdfBase64        PDF bytes, standard or data-URL base64 (or pdf: { filename, base64, pages })
 *   pdfPages?        page count; counted from the file when omitted
 *   overwrite?       replace an existing recap or PDF (default false)
 *   dryRun?          resolve the session and return it without writing (default false)
 *   createIfMissing? when no session falls on that LA date, create a past one (default false)
 *   forceCreate?     with createIfMissing, create even if a session is within ±1 LA day (default false)
 *
 * An exact date match is updated in place. forceCreate does not add a second session on a date that already has one.
 *
 * Matches the session whose startsAt falls on that LA date. Never creates a session
 * unless createIfMissing is true. Zero or several matches is 409, with every session
 * within ±1 LA day in `candidates`. A session that already has a recap or PDF is 409
 * unless overwrite is true. PDFs are stored at recaps/{cid}/{sid}/{file}.pdf with no
 * public download URL.
 *
 * Vercel rejects request bodies over 4.5 MB before this route runs, so a base64 PDF
 * needs to stay under about 3 MB on the hosted app. The route itself allows the same
 * 25 MB PDF cap as the in-app uploader.
 */
export async function POST(request: Request) {
  if (!secretOk(request)) return deny();
  if (!adminConfigured()) return Response.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  const len = Number(request.headers.get("content-length") || 0);
  if (len > 40_000_000) return Response.json({ error: "That PDF is too large." }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Send JSON." }, { status: 400 }); }
  const parsed = parseRecapImport(body);
  if (!parsed.ok) return Response.json(parsed.body, { status: parsed.status });
  try {
    const result = await publishRecap(firebaseRecapDeps(adminDb(), adminBucket()), parsed.value);
    return Response.json(result.body, { status: result.status });
  } catch {
    return Response.json({ error: "Couldn't save that recap." }, { status: 500 });
  }
}
