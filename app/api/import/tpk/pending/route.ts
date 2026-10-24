import { adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";
import { BOOKINGS, CONFIG_DOC, createOrLink, loadConfig, needsReview, notOnTpk, ownerCampaigns, saveRuleFrom, undoAssign, type StoredBooking } from "@/lib/tpk-import";
import { matchBooking, parseGm, weekdayInTz, type PendingBooking, type TpkRule } from "@/lib/tpk-rules";

export const dynamic = "force-dynamic";

async function context(request: Request, method: "GET" | "POST" = "POST") {
  if (!adminConfigured()) return { error: Response.json({ error: "Not configured." }, { status: 503 }) };
  const who = await verifyBearer(request);
  if (!who) return { error: Response.json({ error: "Sign in first." }, { status: 401 }) };
  const db = adminDb();
  const cfg = await loadConfig(db);
  // Organizer-only: the bookings are the owner's TPK account.
  if (!cfg.ownerUid || who.uid !== cfg.ownerUid) {
    // Signed-in non-owners simply have nothing to sync: an empty list, not an error.
    if (method === "GET") return { error: Response.json({ bookings: [], notOnTpk: [], campaigns: [] }) };
    return { error: Response.json({ error: "Only the organizer can assign bookings." }, { status: 403 }) };
  }
  return { db, cfg, uid: who.uid };
}

async function listFor(db: FirebaseFirestore.Firestore, cfg: Awaited<ReturnType<typeof loadConfig>>) {
  const campaigns = await ownerCampaigns(db, cfg.ownerUid!);
  const snap = await db.collection(BOOKINGS).where("ownerUid", "==", cfg.ownerUid).get();
  const now = Date.now();
  const rows: (PendingBooking & { review?: boolean })[] = [];
  const all: StoredBooking[] = [];
  for (const d of snap.docs) {
    const b = d.data() as StoredBooking;
    all.push(b);
    const flagged = b.possiblyCancelled && b.status === "assigned" && !b.cancelAck && new Date(b.startISO).getTime() > now;
    const review = !flagged && needsReview(b);
    if (b.status !== "pending" && !flagged && !review) continue;
    const m = b.status === "pending" ? matchBooking(b.service, b.startISO, cfg.rules, campaigns) : null;
    rows.push({
      key: d.id, service: b.service, startISO: b.startISO, endISO: b.endISO, location: b.location, status: b.status,
      possiblyCancelled: !!b.possiblyCancelled, cid: b.cid ?? null, sessionId: b.sessionId ?? null, linked: !!b.linked,
      suggestedCids: m && (m.kind === "auto" ? [m.cid] : m.kind === "suggest" ? m.cids : []) || [],
      reason: m && m.kind !== "auto" && m.kind !== "ignore" ? m.reason : undefined,
      review,
    });
  }
  rows.sort((a, b) => a.startISO.localeCompare(b.startISO));
  return { bookings: rows, notOnTpk: await notOnTpk(db, cfg, all), campaigns: campaigns.map(({ id, name }) => ({ id, name })) };
}

export async function GET(request: Request) {
  const ctx = await context(request, "GET");
  if ("error" in ctx) return ctx.error;
  return Response.json(await listFor(ctx.db, ctx.cfg));
}

/**
 * Body: { action: "assign" | "ignore" | "keep" | "undo" | "change", id, cid?, saveRule?: boolean }
 *    or { action: "dismiss", cid, sid }  (a "Not on TPK" session: booked elsewhere / not needed)
 */
export async function POST(request: Request) {
  const ctx = await context(request);
  if ("error" in ctx) return ctx.error;
  const { db, cfg } = ctx;
  const body = (await request.json().catch(() => ({}))) as { action?: string; id?: string; cid?: string; sid?: string; saveRule?: boolean };
  if (body.action === "dismiss") {
    if (!body.cid || !body.sid || !/^[\w-]{1,200}$/.test(body.cid + body.sid)) return Response.json({ error: "Unknown session." }, { status: 400 });
    const camp = await db.collection("campaigns").doc(body.cid).get();
    if (!camp.exists || (camp.data() as { ownerUid?: string }).ownerUid !== cfg.ownerUid) return Response.json({ error: "That campaign isn't yours." }, { status: 403 });
    await db.doc(CONFIG_DOC).set({ notOnTpkDismissed: { [`${body.cid}/${body.sid}`]: new Date().toISOString() } }, { merge: true });
    return Response.json({ ok: true, ...(await listFor(db, await loadConfig(db))) });
  }
  if (!body.id || !/^tpk-[a-f0-9]{20}$/.test(body.id)) return Response.json({ error: "Unknown booking." }, { status: 400 });
  const ref = db.collection(BOOKINGS).doc(body.id);
  const snap = await ref.get();
  if (!snap.exists || (snap.data() as { ownerUid?: string }).ownerUid !== cfg.ownerUid) return Response.json({ error: "Unknown booking." }, { status: 404 });
  const b = snap.data() as PendingBooking;
  const at = new Date().toISOString();
  if (body.action === "ignore") {
    await ref.set(b.status === "assigned" ? { cancelAck: true, ackAt: at } : { status: "ignored", ignoredAt: at }, { merge: true });
    return Response.json({ ok: true, ...(await listFor(db, cfg)) });
  }
  if (body.action === "keep") {
    await ref.set({ reviewed: true, reviewedAt: at }, { merge: true });
    return Response.json({ ok: true, ...(await listFor(db, cfg)) });
  }
  if (body.action === "change" && !(await ownerCampaigns(db, cfg.ownerUid!)).some((c) => c.id === body.cid)) return Response.json({ error: "That campaign isn't yours." }, { status: 403 });
  let undone: { removed: boolean; kept: boolean } | null = null;
  if (body.action === "undo" || body.action === "change") {
    if (b.status !== "assigned") return Response.json({ error: "That booking isn't assigned." }, { status: 409 });
    undone = await undoAssign(db, b as StoredBooking);
    await ref.set({ status: "pending", cid: null, sessionId: null, linked: false, reviewed: true, undoneAt: at }, { merge: true });
    if (body.action === "undo") return Response.json({ ok: true, undone, ...(await listFor(db, cfg)) });
  }
  if ((body.action !== "assign" && body.action !== "change") || !body.cid) return Response.json({ error: "Pick a campaign." }, { status: 400 });
  const campaigns = await ownerCampaigns(db, cfg.ownerUid!);
  const c = campaigns.find((x) => x.id === body.cid);
  if (!c) return Response.json({ error: "That campaign isn't yours." }, { status: 403 });
  const r = await createOrLink(db, c.id, c.name, c.tz, { key: b.key, service: b.service, startISO: b.startISO, endISO: b.endISO });
  await ref.set({ status: "assigned", cid: c.id, sessionId: r!.sessionId, linked: r!.linked, assignedBy: "organizer", assignedAt: at, reviewed: true }, { merge: true });
  let rule: TpkRule | null = null;
  const gm = parseGm(b.service);
  if (body.saveRule && gm) {
    const wd = weekdayInTz(b.startISO);
    rule = { id: `saved-${gm.toLowerCase().replace(/[^a-z]+/g, "-")}-${wd}`, mode: "auto", gm, weekdays: [wd], cid: c.id, note: `Saved from Assign: ${c.name}` };
    await db.doc(CONFIG_DOC).set({ rules: saveRuleFrom(cfg.rules, rule), updatedAt: at }, { merge: true });
  }
  const fresh = await loadConfig(db);
  return Response.json({ ok: true, sessionId: r!.sessionId, linked: r!.linked, rule, undone, ...(await listFor(db, fresh)) });
}
