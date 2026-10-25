/**
 * Attach an Archivist recap (markdown + PDF) to an existing session,
 * or backfill a past session when createIfMissing is set.
 * Server only. The route guards this with TPK_IMPORT_SECRET (see secretOk).
 */
import type { Firestore } from "firebase-admin/firestore";
import { latestRecap } from "./model";
import { omitUndefined } from "./omit";
import { PDF_MAX_BYTES, countPdfPages, excerpt, markdownToHtml, nestedRecapPath, recapPlain, validatePdf } from "./recap";
import { sanitizeRecapHtml, stripHtml } from "./sanitize";
import { ymdInZone, zonedTimeToUtc } from "./time";
import { TPK_PLACE, TPK_TZ } from "./tpk-rules";
import type { Session } from "./types";

export const RECAP_TZ = TPK_TZ;
/** Blank legacy nights were stored as 6:00 PM Pacific, four hours long. */
export const LEGACY_START = "18:00";
export const LEGACY_DURATION_MIN = 240;
const MARKDOWN_MAX = 200_000;
const DAY_MS = 86_400_000;

export type RecapImportInput = {
  cid: string;
  /** Local date in America/Los_Angeles, YYYY-MM-DD. */
  date: string;
  markdown: string;
  filename: string;
  pdf: Buffer;
  pdfPages?: number;
  overwrite: boolean;
  dryRun: boolean;
  createIfMissing: boolean;
  forceCreate: boolean;
};

export type StoredSession = {
  id: string;
  startsAt?: string;
  endsAt?: string;
  tz?: string;
  title?: string;
  location?: string;
  status?: string;
  occurrenceKey?: string | null;
  notes?: string;
  recapText?: string;
  recapHtml?: string;
  recapMarkdown?: string;
  pdfPath?: string;
  pdfName?: string;
  pdfSize?: number;
  pdfPages?: number | null;
  pdfUrl?: string | null;
  extraPdfs?: { path?: string; name?: string }[];
};

export type CampaignRec = {
  name: string;
  defaultLocation: string;
  previouslyOn?: string;
  previouslyOnSessionId?: string;
};

export type RecapCandidate = {
  id: string;
  cid: string;
  title: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  tz: string;
  occurrenceKey: string | null;
  location: string;
  localDate: string | null;
  /** Calendar days from the requested LA date. Negative is earlier. */
  offsetDays: number | null;
  hasRecap: boolean;
};

export type RecapDeps = {
  now?: Date;
  loadCampaign(cid: string): Promise<CampaignRec | null>;
  loadSessions(cid: string): Promise<StoredSession[]>;
  /** False when the document already exists. */
  createSession(cid: string, sid: string, data: Record<string, unknown>): Promise<boolean>;
  mergeSession(cid: string, sid: string, data: Record<string, unknown>): Promise<void>;
  mergeCampaign(cid: string, data: Record<string, unknown>): Promise<void>;
  savePdf(path: string, bytes: Buffer): Promise<void>;
  removePdf(path: string): Promise<void>;
};

type Fail = { ok: false; status: number; body: Record<string, unknown> };
type Ok = { ok: true; status: number; body: Record<string, unknown> };

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addCalendarDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export function calendarOffset(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

function instantOf(value: unknown): Date | null {
  if (typeof value === "string" && value) {
    const t = new Date(value);
    return Number.isNaN(t.getTime()) ? null : t;
  }
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const t = (value as { toDate: () => Date }).toDate();
    return t instanceof Date && !Number.isNaN(t.getTime()) ? t : null;
  }
  return null;
}

/**
 * The night's play date in America/Los_Angeles, taken from startsAt.
 * occurrenceKey is the original series slot and stays put when a night is moved,
 * so it is used only when startsAt is missing.
 */
export function sessionLocalDate(session: { startsAt?: unknown; occurrenceKey?: unknown }): string | null {
  const starts = instantOf(session.startsAt);
  if (starts) return ymdInZone(starts, RECAP_TZ);
  if (typeof session.occurrenceKey === "string" && isIsoDate(session.occurrenceKey)) return session.occurrenceKey;
  return null;
}

export function legacySessionId(date: string): string {
  return `legacy-${date}`;
}

export function storedHasRecap(data: Pick<StoredSession, "recapText" | "recapHtml" | "recapMarkdown" | "pdfPath" | "pdfName" | "extraPdfs">): boolean {
  const text = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  if (text(data.recapText) || text(data.recapHtml) || text(data.recapMarkdown) || text(data.pdfPath) || text(data.pdfName)) return true;
  return Array.isArray(data.extraPdfs) && data.extraPdfs.some((file) => !!file && typeof file.path === "string" && file.path.trim().length > 0);
}

/** Same fields a migrated past night has, so history and the recaps list can render it. */
export function legacySessionRecord(cid: string, date: string, campaign: { name: string; defaultLocation?: string }): Record<string, unknown> {
  const starts = zonedTimeToUtc(date, LEGACY_START, RECAP_TZ);
  const ends = new Date(starts.getTime() + LEGACY_DURATION_MIN * 60_000);
  const location = (campaign.defaultLocation || "").trim() || TPK_PLACE;
  return {
    cid,
    seriesId: null,
    occurrenceKey: date,
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    tz: RECAP_TZ,
    title: (campaign.name || "").trim() || cid,
    location,
    // History lists status "scheduled" once endsAt has passed. There is no "completed" status.
    status: "scheduled",
    exception: null,
    requireRsvps: null,
    seq: 0,
    attendance: {},
    source: "archivist",
  };
}

function flag(value: unknown, name: string): boolean | string {
  if (value === undefined || value === false) return false;
  if (value === true) return true;
  return `${name} must be true or false.`;
}

function stringField(body: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function decodePdf(raw: string): Buffer | null {
  const cleaned = raw.trim().replace(/^data:application\/pdf;base64,/i, "").replace(/\s+/g, "");
  if (!cleaned || cleaned.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) return null;
  const buf = Buffer.from(cleaned, "base64");
  return buf.length ? buf : null;
}

function looksLikePdf(buf: Buffer): boolean {
  return buf.subarray(0, Math.min(buf.length, 1024)).toString("latin1").includes("%PDF-");
}

export function parseRecapImport(body: unknown): { ok: true; value: RecapImportInput } | Fail {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, body: { error: "Send a JSON object." } };
  }
  const raw = body as Record<string, unknown>;
  const cid = (stringField(raw, ["cid", "campaignId"]) || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cid)) {
    return { ok: false, status: 400, body: { error: "Send a campaign id such as strahd, frostmaiden, or ghosts-of-saltmarsh." } };
  }
  const date = (stringField(raw, ["date", "sessionDate"]) || "").trim();
  if (!isIsoDate(date)) return { ok: false, status: 400, body: { error: "date must be a real LA calendar date, YYYY-MM-DD." } };
  const markdown = stringField(raw, ["markdown", "recapMarkdown"]);
  if (markdown === undefined) return { ok: false, status: 400, body: { error: "Send the recap markdown." } };
  if (!markdown.trim()) return { ok: false, status: 400, body: { error: "Recap markdown is empty." } };
  if (markdown.length > MARKDOWN_MAX) return { ok: false, status: 400, body: { error: "Recap markdown is too long." } };

  const pdfObj = raw.pdf && typeof raw.pdf === "object" && !Array.isArray(raw.pdf) ? raw.pdf as Record<string, unknown> : null;
  const filename = (stringField(raw, ["filename", "pdfName"]) || (pdfObj && typeof pdfObj.filename === "string" ? pdfObj.filename : "") || (pdfObj && typeof pdfObj.name === "string" ? pdfObj.name : "")).trim();
  const encoded = stringField(raw, ["pdfBase64"]) || (typeof raw.pdf === "string" ? raw.pdf : "") || (pdfObj && typeof pdfObj.base64 === "string" ? pdfObj.base64 : "") || (pdfObj && typeof pdfObj.data === "string" ? pdfObj.data : "");
  if (!filename) return { ok: false, status: 400, body: { error: "Send the PDF filename." } };
  if (filename.length > 180) return { ok: false, status: 400, body: { error: "PDF filename is too long." } };
  if (!encoded) return { ok: false, status: 400, body: { error: "Send the PDF as base64." } };
  const pdf = decodePdf(encoded);
  if (!pdf || !looksLikePdf(pdf)) return { ok: false, status: 400, body: { error: "That file is not a PDF." } };
  const problem = validatePdf({ name: filename, size: pdf.length, type: "application/pdf" });
  if (problem) return { ok: false, status: pdf.length > PDF_MAX_BYTES ? 413 : 400, body: { error: problem } };

  const pagesRaw = raw.pdfPages ?? raw.pages ?? pdfObj?.pages ?? pdfObj?.pdfPages;
  let pdfPages: number | undefined;
  if (pagesRaw !== undefined && pagesRaw !== null) {
    if (typeof pagesRaw !== "number" || !Number.isInteger(pagesRaw) || pagesRaw < 1 || pagesRaw > 9999) {
      return { ok: false, status: 400, body: { error: "pdfPages must be a positive integer." } };
    }
    pdfPages = pagesRaw;
  }
  const overwrite = flag(raw.overwrite, "overwrite");
  const dryRun = flag(raw.dryRun, "dryRun");
  const createIfMissing = flag(raw.createIfMissing, "createIfMissing");
  const forceCreate = flag(raw.forceCreate, "forceCreate");
  for (const item of [overwrite, dryRun, createIfMissing, forceCreate]) {
    if (typeof item === "string") return { ok: false, status: 400, body: { error: item } };
  }
  return {
    ok: true,
    value: {
      cid, date, markdown, filename, pdf, pdfPages,
      overwrite: overwrite as boolean,
      dryRun: dryRun as boolean,
      createIfMissing: createIfMissing as boolean,
      forceCreate: forceCreate as boolean,
    },
  };
}

function candidate(cid: string, session: StoredSession, requested: string): RecapCandidate {
  const localDate = sessionLocalDate(session);
  return {
    id: session.id,
    cid,
    title: session.title || "",
    status: session.status === "cancelled" ? "cancelled" : "scheduled",
    startsAt: typeof session.startsAt === "string" ? session.startsAt : null,
    endsAt: typeof session.endsAt === "string" ? session.endsAt : null,
    tz: session.tz || RECAP_TZ,
    occurrenceKey: typeof session.occurrenceKey === "string" ? session.occurrenceKey : null,
    location: session.location || "",
    localDate,
    offsetDays: localDate ? calendarOffset(requested, localDate) : null,
    hasRecap: storedHasRecap(session),
  };
}

function conflict(status: number, error: string, reason: string, input: RecapImportInput, matches: RecapCandidate[], candidates: RecapCandidate[]): Fail {
  return { ok: false, status, body: { error, reason, cid: input.cid, date: input.date, matches, candidates } };
}

function toSession(cid: string, stored: StoredSession): Session {
  return {
    id: stored.id,
    cid,
    occurrenceKey: stored.occurrenceKey ?? null,
    startsAt: stored.startsAt || "",
    endsAt: stored.endsAt || stored.startsAt || "",
    tz: stored.tz || RECAP_TZ,
    title: stored.title || "",
    location: stored.location || "",
    status: stored.status === "cancelled" ? "cancelled" : "scheduled",
    requireRsvps: null,
    seq: 0,
    attendance: [],
    recapText: stored.recapText,
    recapHtml: stored.recapHtml,
    recapMarkdown: stored.recapMarkdown,
    pdfPath: stored.pdfPath,
    pdfName: stored.pdfName,
    pdfPages: typeof stored.pdfPages === "number" ? stored.pdfPages : undefined,
  };
}

function previouslyOnUpdate(campaign: CampaignRec, sessions: StoredSession[], cid: string, next: StoredSession, now: Date) {
  const mapped = sessions.map((session) => toSession(cid, session.id === next.id ? { ...session, ...next } : session));
  if (!mapped.some((session) => session.id === next.id)) mapped.push(toSession(cid, next));
  const wasSource = campaign.previouslyOnSessionId === next.id;
  const latest = latestRecap(mapped, cid, now);
  if (!latest || (latest.id !== next.id && !wasSource)) return null;
  const text = recapPlain(latest);
  const line = text ? excerpt(text) : latest.pdfName ? `PDF: ${latest.pdfName}` : "";
  if (!line) return null;
  if (campaign.previouslyOn === line && campaign.previouslyOnSessionId === latest.id) return null;
  return { previouslyOn: line, previouslyOnSessionId: latest.id };
}

function sessionSummary(cid: string, session: StoredSession, date: string) {
  return {
    id: session.id,
    cid,
    title: session.title || "",
    status: session.status === "cancelled" ? "cancelled" : "scheduled",
    startsAt: session.startsAt || null,
    endsAt: session.endsAt || null,
    tz: session.tz || RECAP_TZ,
    occurrenceKey: session.occurrenceKey ?? null,
    location: session.location || "",
    localDate: sessionLocalDate(session) || date,
  };
}

export async function publishRecap(deps: RecapDeps, input: RecapImportInput): Promise<Fail | Ok> {
  const now = deps.now ?? new Date();
  const campaign = await deps.loadCampaign(input.cid);
  if (!campaign) return { ok: false, status: 404, body: { error: `No campaign ${input.cid}.` } };
  const sessions = await deps.loadSessions(input.cid);
  const dated = sessions.map((session) => ({ session, info: candidate(input.cid, session, input.date) }));
  const exact = dated.filter((row) => row.info.offsetDays === 0);
  const nearby = dated.filter((row) => row.info.offsetDays !== null && Math.abs(row.info.offsetDays) <= 1);
  const matches = exact.map((row) => row.info);
  const candidates = nearby.map((row) => row.info).sort((a, b) => (a.localDate || "").localeCompare(b.localDate || "") || a.id.localeCompare(b.id));

  let target: StoredSession | null = null;
  let creating = false;
  if (exact.length === 1) {
    target = exact[0]!.session;
    if (storedHasRecap(target) && !input.overwrite) {
      return conflict(409, "That session already has a recap. Pass overwrite: true to replace it.", "exists", input, matches, candidates);
    }
  } else if (exact.length > 1) {
    return conflict(409, `More than one session on ${input.date} in ${input.cid}.`, "ambiguous", input, matches, candidates);
  } else if (!input.createIfMissing) {
    return conflict(409, `No session on ${input.date} in ${input.cid}.`, "none", input, matches, candidates);
  } else {
    const neighbors = candidates.filter((row) => row.offsetDays !== 0);
    if (neighbors.length && !input.forceCreate) {
      return conflict(409, `A session is within a day of ${input.date}. Pass forceCreate: true to add another, or publish onto that date.`, "neighbor", input, matches, neighbors);
    }
    const fresh = legacySessionRecord(input.cid, input.date, campaign);
    if (new Date(String(fresh.endsAt)).getTime() >= now.getTime()) {
      return { ok: false, status: 400, body: { error: `Refusing to create ${input.date}: a backfilled night is 6:00–10:00 PM Pacific and that night has not ended.` } };
    }
    const sid = legacySessionId(input.date);
    const taken = sessions.find((session) => session.id === sid);
    if (taken) {
      const info = candidate(input.cid, taken, input.date);
      return conflict(409, `Session id ${sid} already exists.`, "taken", input, matches, candidates.some((row) => row.id === sid) ? candidates : [...candidates, info]);
    }
    target = { id: sid, ...(fresh as Omit<StoredSession, "id">) };
    creating = true;
  }
  if (!target) return conflict(409, `No session on ${input.date} in ${input.cid}.`, "none", input, matches, candidates);

  const pdfPages = input.pdfPages ?? await countPdfPages(new Blob([Uint8Array.from(input.pdf)]));
  const pdfPath = nestedRecapPath(input.cid, target.id, input.filename);
  const pdfName = input.filename.split(/[/\\]/).pop() || input.filename;
  const recapHtml = sanitizeRecapHtml(markdownToHtml(input.markdown));
  const recapText = stripHtml(recapHtml);
  const recapFields: Record<string, unknown> = {
    recapMarkdown: input.markdown,
    recapHtml,
    recapText,
    pdfPath,
    pdfName,
    pdfSize: input.pdf.length,
    pdfPages: pdfPages ?? null,
    pdfUrl: null,
  };
  const saved: StoredSession = {
    ...target,
    recapMarkdown: input.markdown,
    recapHtml,
    recapText,
    pdfPath,
    pdfName,
    pdfSize: input.pdf.length,
    pdfPages: pdfPages ?? null,
    pdfUrl: null,
  };
  const previous = previouslyOnUpdate(campaign, sessions, input.cid, saved, now);
  const body = {
    ok: true,
    dryRun: input.dryRun,
    created: creating,
    cid: input.cid,
    date: input.date,
    session: sessionSummary(input.cid, saved, input.date),
    pdfPath,
    pdfName,
    pdfSize: input.pdf.length,
    pdfPages: pdfPages ?? null,
    ...(previous ? { previouslyOn: previous.previouslyOn } : {}),
  };
  if (input.dryRun) return { ok: true, status: 200, body };

  await deps.savePdf(pdfPath, input.pdf);
  try {
    if (creating) {
      const data = omitUndefined({ ...legacySessionRecord(input.cid, input.date, campaign), ...recapFields });
      if (pdfPages === undefined) delete data.pdfPages;
      delete data.pdfUrl;
      const wrote = await deps.createSession(input.cid, target.id, data);
      if (!wrote) {
        await deps.removePdf(pdfPath).catch(() => undefined);
        return conflict(409, `Session id ${target.id} already exists.`, "taken", input, matches, candidates);
      }
    } else {
      await deps.mergeSession(input.cid, target.id, omitUndefined(recapFields));
      const oldPath = target.pdfPath;
      if (typeof oldPath === "string" && oldPath !== pdfPath && oldPath.startsWith(`recaps/${input.cid}/${target.id}/`)) {
        await deps.removePdf(oldPath).catch(() => undefined);
      }
    }
  } catch (err) {
    if (creating || target.pdfPath !== pdfPath) await deps.removePdf(pdfPath).catch(() => undefined);
    throw err;
  }
  if (previous) await deps.mergeCampaign(input.cid, previous);
  return { ok: true, status: 200, body };
}

type BucketLike = {
  file(path: string): {
    save(data: Buffer, options: { resumable: boolean; contentType: string; metadata: { contentType: string; cacheControl: string } }): Promise<unknown>;
    delete(options: { ignoreNotFound: boolean }): Promise<unknown>;
  };
};

/** Firestore + Storage adapter. Admin credentials bypass member-only storage rules; no public URL is written. */
export function firebaseRecapDeps(db: Firestore, bucket: BucketLike): RecapDeps {
  return {
    async loadCampaign(cid) {
      const snap = await db.collection("campaigns").doc(cid).get();
      if (!snap.exists) return null;
      const data = snap.data() || {};
      return {
        name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : cid,
        defaultLocation: typeof data.defaultLocation === "string" ? data.defaultLocation : "",
        previouslyOn: typeof data.previouslyOn === "string" ? data.previouslyOn : undefined,
        previouslyOnSessionId: typeof data.previouslyOnSessionId === "string" ? data.previouslyOnSessionId : undefined,
      };
    },
    async loadSessions(cid) {
      const snap = await db.collection("campaigns").doc(cid).collection("sessions").get();
      return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<StoredSession, "id">) }));
    },
    async createSession(cid, sid, data) {
      try {
        await db.collection("campaigns").doc(cid).collection("sessions").doc(sid).create(data);
        return true;
      } catch (err) {
        const code = (err as { code?: number | string }).code;
        if (code === 6 || code === "already-exists") return false;
        throw err;
      }
    },
    async mergeSession(cid, sid, data) {
      await db.collection("campaigns").doc(cid).collection("sessions").doc(sid).set(data, { merge: true });
    },
    async mergeCampaign(cid, data) {
      await db.collection("campaigns").doc(cid).set(data, { merge: true });
    },
    async savePdf(path, bytes) {
      await bucket.file(path).save(bytes, {
        resumable: false,
        contentType: "application/pdf",
        metadata: { contentType: "application/pdf", cacheControl: "private, max-age=0" },
      });
    },
    async removePdf(path) {
      await bucket.file(path).delete({ ignoreNotFound: true });
    },
  };
}
