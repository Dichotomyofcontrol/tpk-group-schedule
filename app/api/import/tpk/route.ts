import { adminConfigured, adminDb } from "@/lib/firebase-admin";
import { runImport, secretOk, type IncomingBooking } from "@/lib/tpk-import";

export const dynamic = "force-dynamic";

const deny = () => Response.json({ error: "Unauthorized." }, { status: 401 });

/**
 * POST /api/import/tpk  (Authorization: Bearer $TPK_IMPORT_SECRET)
 * Body: [{service,startISO,durationHours,location,source:'tpk',externalKey}]
 *   or { bookings: [...], list?: "upcoming" | "past", dryRun?: boolean }
 */
export async function POST(request: Request) {
  if (!secretOk(request)) return deny();
  if (!adminConfigured()) return Response.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Send JSON." }, { status: 400 }); }
  const wrapped = !Array.isArray(body) && body && typeof body === "object" ? (body as { bookings?: unknown; list?: unknown; dryRun?: unknown }) : null;
  const list = (Array.isArray(body) ? body : wrapped?.bookings) as IncomingBooking[] | undefined;
  if (!Array.isArray(list)) return Response.json({ error: "Send a list of bookings." }, { status: 400 });
  if (list.length > 500) return Response.json({ error: "At most 500 bookings per call." }, { status: 413 });
  const listKind = wrapped?.list === "past" ? "past" : "upcoming";
  const result = await runImport(adminDb(), list, { listKind, dryRun: wrapped?.dryRun === true });
  return Response.json(result);
}

/** GET: a read-only dry run with no bookings. Shows which campaigns each rule resolves to. */
export async function GET(request: Request) {
  if (!secretOk(request)) return deny();
  if (!adminConfigured()) return Response.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  const result = await runImport(adminDb(), [], { listKind: "past", dryRun: true });
  return Response.json({ resolved: result.resolved, errors: result.errors });
}
