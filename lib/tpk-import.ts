/** TPK Brewing booking import: the Firestore side. Server only (Admin SDK). */
import { createHash, timingSafeEqual } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import {
  DEFAULT_RULES, TPK_PLACE, TPK_TZ, bookingKey, durationOf, localDate, matchBooking,
  type CampaignLite, type PendingBooking, type TpkConfig, type TpkRule,
} from "./tpk-rules";

export const CONFIG_DOC = "tpkImport/config";
export const BOOKINGS = "pendingBookings";
const DEFAULT_OWNER_EMAIL = "sthomas131@gmail.com";

export type IncomingBooking = { service: string; startISO: string; durationHours?: number; location?: string; source?: string; externalKey?: string };

export function secretOk(request: Request): boolean {
  const secret = process.env.TPK_IMPORT_SECRET || "";
  const header = request.headers.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || !given) return false;
  const a = Buffer.from(secret), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const docId = (key: string) => "tpk-" + createHash("sha1").update(key).digest("hex").slice(0, 20);

/** Reads (and on first use seeds) the editable rules. */
export async function loadConfig(db: Firestore): Promise<Omit<TpkConfig, "ownerUid"> & { ownerUid: string | null }> {
  const ref = db.doc(CONFIG_DOC);
  const snap = await ref.get();
  let cfg = (snap.exists ? snap.data() : null) as TpkConfig | null;
  if (!cfg) {
    cfg = { ownerEmail: DEFAULT_OWNER_EMAIL, rules: DEFAULT_RULES, updatedAt: new Date().toISOString() };
    await ref.set(cfg);
  }
  let ownerUid = cfg.ownerUid || null;
  if (!ownerUid && cfg.ownerEmail) {
    const users = await db.collection("users").where("email", "==", cfg.ownerEmail).limit(1).get();
    ownerUid = users.docs[0]?.id || null;
  }
  return { ...cfg, rules: Array.isArray(cfg.rules) ? cfg.rules : DEFAULT_RULES, ownerUid };
}

/** Active, non-one-shot campaigns the owner organizes. */
export async function ownerCampaigns(db: Firestore, ownerUid: string): Promise<(CampaignLite & { tz: string })[]> {
  const snap = await db.collection("campaigns").where("ownerUid", "==", ownerUid).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as { name?: string; tz?: string; status?: string; kind?: string }) }))
    .filter((c) => c.status !== "archived" && c.kind !== "oneshot")
    .map((c) => ({ id: c.id, name: c.name || c.id, tz: c.tz || TPK_TZ }));
}

/** Creates the session, or links to one already on that campaign and date. Never edits an existing session. */
export async function createOrLink(db: Firestore, cid: string, campaignName: string, tz: string, b: { key: string; service: string; startISO: string; endISO: string }, allowCreate = true): Promise<{ sessionId: string; linked: boolean } | null> {
  const day = localDate(b.startISO, tz);
  const sessions = await db.collection("campaigns").doc(cid).collection("sessions").get();
  const same = sessions.docs.find((d) => {
    const s = d.data() as { startsAt?: string; status?: string };
    return s.startsAt && s.status !== "cancelled" && localDate(s.startsAt, tz) === day;
  });
  if (same) return { sessionId: same.id, linked: true };
  if (!allowCreate) return null;
  const sid = `${cid}-${docId(b.key)}`;
  const ref = db.collection("campaigns").doc(cid).collection("sessions").doc(sid);
  const existing = await ref.get();
  if (existing.exists) return { sessionId: sid, linked: true };
  await ref.create({
    cid, seriesId: null, occurrenceKey: null,
    startsAt: new Date(b.startISO).toISOString(), endsAt: new Date(b.endISO).toISOString(), tz,
    title: campaignName, location: TPK_PLACE, status: "scheduled", exception: null, requireRsvps: null,
    seq: 0, attendance: {}, source: "tpk", tpkKey: b.key,
  });
  return { sessionId: sid, linked: false };
}

export type ImportResult = { received: number; created: number; linked: number; pending: number; ignored: number; unchanged: number; flaggedCancelled: number; restored: number; errors: string[]; dryRun: boolean; addedFromTpk?: number; toAssign?: number; notOnTpk?: number; notOnTpkSessions?: NotOnTpk[]; resolved?: { rule: string; mode: string; campaigns: { id: string; name: string }[] }[] };

export async function runImport(db: Firestore, list: IncomingBooking[], opts: { listKind: "upcoming" | "past"; dryRun: boolean; now?: Date }): Promise<ImportResult> {
  const now = opts.now ?? new Date();
  const cfg = await loadConfig(db);
  const out: ImportResult = { received: list.length, created: 0, linked: 0, pending: 0, ignored: 0, unchanged: 0, flaggedCancelled: 0, restored: 0, errors: [], dryRun: opts.dryRun };
  if (!cfg.ownerUid) { out.errors.push("Owner account not found."); return out; }
  const campaigns = await ownerCampaigns(db, cfg.ownerUid);
  out.resolved = cfg.rules.map((r) => ({ rule: r.id, mode: r.mode, campaigns: r.mode === "ignore" ? [] : campaigns.filter((c) => r.cid ? c.id === r.cid : r.campaign ? c.name.toLowerCase().includes(r.campaign.toLowerCase()) : false).map(({ id, name }) => ({ id, name })) }));
  const seen = new Set<string>();
  for (const raw of list) {
    const service = typeof raw?.service === "string" ? raw.service.trim().slice(0, 200) : "";
    const t = new Date(raw?.startISO ?? "").getTime();
    if (!service || !Number.isFinite(t)) { out.errors.push(`Skipped a booking without a service or a valid startISO.`); continue; }
    const startISO = new Date(t).toISOString();
    const hours = durationOf(service, raw.durationHours);
    const endISO = new Date(t + hours * 3_600_000).toISOString();
    const key = bookingKey(service, startISO);
    const id = docId(key);
    seen.add(id);
    const ref = db.collection(BOOKINGS).doc(id);
    const snap = await ref.get();
    const prev = snap.exists ? (snap.data() as PendingBooking) : null;
    const base = { key, service, startISO, endISO, durationHours: hours, location: String(raw.location || "").slice(0, 200), source: "tpk", externalKey: String(raw.externalKey || key).slice(0, 300), ownerUid: cfg.ownerUid, lastSeenAt: now.toISOString(), list: opts.listKind };
    if (prev) {
      if (prev.possiblyCancelled) out.restored++; else out.unchanged++;
      if (!opts.dryRun) await ref.set({ ...base, possiblyCancelled: false }, { merge: true });
      continue;
    }
    const m = matchBooking(service, startISO, cfg.rules, campaigns);
    let doc: Record<string, unknown> = { ...base, firstSeenAt: now.toISOString(), status: "pending", cid: null, sessionId: null, possiblyCancelled: false };
    if (m.kind === "ignore") { doc.status = "marker"; out.ignored++; }
    else if (m.kind === "auto") {
      const c = campaigns.find((x) => x.id === m.cid)!;
      // Past nights only ever link; a new session is created only for a night still ahead.
      const r = opts.dryRun ? null : await createOrLink(db, c.id, c.name, c.tz, { key, service, startISO, endISO }, t > now.getTime());
      if (opts.dryRun) { if (t > now.getTime()) out.created++; else out.pending++; }
      else if (r) {
        doc = { ...doc, status: "assigned", cid: c.id, sessionId: r.sessionId, linked: r.linked, assignedBy: "rule:" + m.ruleId, reviewed: false };
        if (r.linked) out.linked++; else out.created++;
      } else out.pending++;
    } else out.pending++;
    if (!opts.dryRun) await ref.set(doc);
  }
  // Upcoming list only: a future booking that vanished is flagged, never deleted.
  if (opts.listKind === "upcoming") {
    const stored = await db.collection(BOOKINGS).where("ownerUid", "==", cfg.ownerUid).get();
    for (const d of stored.docs) {
      const b = d.data() as PendingBooking;
      if (seen.has(d.id) || b.possiblyCancelled || new Date(b.startISO).getTime() <= now.getTime()) continue;
      out.flaggedCancelled++;
      if (!opts.dryRun) await d.ref.set({ possiblyCancelled: true, cancelledFlaggedAt: now.toISOString() }, { merge: true });
    }
  }
  if (opts.listKind === "upcoming" && !opts.dryRun) await db.doc(CONFIG_DOC).set({ lastUpcomingAt: now.toISOString() }, { merge: true });
  // Two-way summary: what Seth still has to look at.
  const stored = await db.collection(BOOKINGS).where("ownerUid", "==", cfg.ownerUid).get();
  const all = stored.docs.map((d) => d.data() as StoredBooking);
  out.addedFromTpk = all.filter(needsReview).length;
  out.toAssign = all.filter((b) => b.status === "pending").length;
  if (!opts.dryRun || opts.listKind === "upcoming") {
    const fresh = await loadConfig(db);
    const miss = await notOnTpk(db, fresh, all, now);
    out.notOnTpk = miss.length; out.notOnTpkSessions = miss;
  }
  return out;
}

export type StoredBooking = PendingBooking & { reviewed?: boolean; assignedBy?: string; cancelAck?: boolean; lastSeenAt?: string; list?: string };
/** An auto-matched booking Seth hasn't confirmed yet. Older docs with no `reviewed` field count too. */
export const needsReview = (b: StoredBooking) => b.status === "assigned" && String(b.assignedBy || "").startsWith("rule:") && b.reviewed !== true;

export type NotOnTpk = { cid: string; sid: string; campaign: string; title: string; startsAt: string; tz: string; location: string };
export const NOT_ON_TPK_DAYS = 120;
export const MATCH_HOURS = 4;
export const atTpk = (loc?: string) => !loc || !loc.trim() || /tpk\s*brewing/i.test(loc);

/** Upcoming sessions at TPK Brewing (or no place yet) with no live booking within ±4h in the bookings list. Only once an upcoming list has been imported. */
export async function notOnTpk(db: Firestore, cfg: Awaited<ReturnType<typeof loadConfig>>, bookings: StoredBooking[], now = new Date()): Promise<NotOnTpk[]> {
  const c = cfg as typeof cfg & { lastUpcomingAt?: string; notOnTpkDismissed?: Record<string, string> };
  if (!c.ownerUid || !c.lastUpcomingAt) return [];
  const dismissed = c.notOnTpkDismissed || {};
  const live = bookings.filter((b) => !b.possiblyCancelled).map((b) => new Date(b.startISO).getTime());
  const from = now.toISOString(), to = new Date(now.getTime() + NOT_ON_TPK_DAYS * 86_400_000).toISOString();
  const camps = await db.collection("campaigns").where("ownerUid", "==", c.ownerUid).get();
  const out: NotOnTpk[] = [];
  for (const cd of camps.docs) {
    const camp = cd.data() as { name?: string; status?: string; tz?: string };
    if (camp.status === "archived") continue;
    const ss = await cd.ref.collection("sessions").where("startsAt", ">=", from).where("startsAt", "<=", to).get();
    for (const sd of ss.docs) {
      const s = sd.data() as { startsAt: string; status?: string; title?: string; location?: string; tz?: string };
      if (s.status === "cancelled" || !atTpk(s.location) || dismissed[`${cd.id}/${sd.id}`]) continue;
      const t = new Date(s.startsAt).getTime();
      if (live.some((bt) => Math.abs(bt - t) <= MATCH_HOURS * 3_600_000)) continue;
      out.push({ cid: cd.id, sid: sd.id, campaign: camp.name || cd.id, title: s.title || camp.name || "Session", startsAt: s.startsAt, tz: s.tz || camp.tz || TPK_TZ, location: s.location || "" });
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Undo an auto-add: removes the session only if the import created it and nobody has touched it; a linked night is just unlinked. */
export async function undoAssign(db: Firestore, b: StoredBooking): Promise<{ removed: boolean; kept: boolean }> {
  let removed = false, kept = false;
  if (b.cid && b.sessionId && !b.linked) {
    const ref = db.collection("campaigns").doc(b.cid).collection("sessions").doc(b.sessionId);
    const snap = await ref.get();
    if (snap.exists) {
      const s = snap.data() as Record<string, unknown>;
      const untouched = s.source === "tpk" && s.tpkKey === b.key && Object.keys((s.attendance as object) || {}).length === 0 && !s.notes && !s.recapText && !s.recap && Number(s.seq || 0) === 0;
      if (untouched) { await ref.delete(); removed = true; } else kept = true;
    }
  }
  return { removed, kept };
}

export function saveRuleFrom(rules: TpkRule[], rule: TpkRule): TpkRule[] {
  const same = (r: TpkRule) => r.cid && rule.gm && r.gm?.toLowerCase() === rule.gm.toLowerCase() && JSON.stringify(r.weekdays) === JSON.stringify(rule.weekdays);
  return [rule, ...rules.filter((r) => !same(r))];
}
