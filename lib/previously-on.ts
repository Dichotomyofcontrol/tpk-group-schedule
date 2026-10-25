/**
 * Set the read-aloud Previously on markdown for one session.
 * Server only. The route guards this with TPK_IMPORT_SECRET (see secretOk).
 */
import { calendarOffset, isIsoDate, sessionLocalDate, type StoredSession } from "./recap-import";

export const PREVIOUSLY_ON_MAX = 12_000;

export type PreviouslyOnInput = {
  cid: string;
  /** Local date in America/Los_Angeles, YYYY-MM-DD. */
  date: string;
  /** Markdown. Empty clears the field. */
  previouslyOn: string;
  dryRun: boolean;
};

export type PreviouslyOnDeps = {
  loadCampaign(cid: string): Promise<{ name: string } | null>;
  loadSessions(cid: string): Promise<StoredSession[]>;
  /** `null` removes the field. */
  mergeSession(cid: string, sid: string, data: { previouslyOn: string | null }): Promise<void>;
};

type Fail = { ok: false; status: number; body: Record<string, unknown> };
type Ok = { ok: true; status: number; body: Record<string, unknown> };

function stringField(body: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

export function parsePreviouslyOn(body: unknown): { ok: true; value: PreviouslyOnInput } | Fail {
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
  const markdown = stringField(raw, ["previouslyOn", "markdown"]);
  if (markdown === undefined) return { ok: false, status: 400, body: { error: "Send the previouslyOn markdown." } };
  const previouslyOn = markdown.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  if (previouslyOn.length > PREVIOUSLY_ON_MAX) {
    return { ok: false, status: 400, body: { error: "That opener is too long." } };
  }
  const dryRun = raw.dryRun;
  if (dryRun !== undefined && dryRun !== true && dryRun !== false) {
    return { ok: false, status: 400, body: { error: "dryRun must be true or false." } };
  }
  return { ok: true, value: { cid, date, previouslyOn, dryRun: dryRun === true } };
}

function brief(session: StoredSession, date: string) {
  return {
    id: session.id,
    title: session.title || "",
    startsAt: session.startsAt || null,
    localDate: sessionLocalDate(session) || date,
    status: session.status === "cancelled" ? "cancelled" : "scheduled",
  };
}

export async function publishPreviouslyOn(deps: PreviouslyOnDeps, input: PreviouslyOnInput): Promise<Fail | Ok> {
  const campaign = await deps.loadCampaign(input.cid);
  if (!campaign) return { ok: false, status: 404, body: { error: `No campaign ${input.cid}.` } };
  const sessions = await deps.loadSessions(input.cid);
  const dated = sessions.map((session) => ({ session, localDate: sessionLocalDate(session) }));
  const exact = dated.filter((row) => row.localDate === input.date && row.session.status !== "cancelled");
  const nearby = dated
    .filter((row) => row.localDate && Math.abs(calendarOffset(input.date, row.localDate)) <= 1)
    .map((row) => brief(row.session, input.date));
  if (exact.length > 1) {
    return {
      ok: false,
      status: 409,
      body: { error: `More than one session on ${input.date} in ${input.cid}.`, reason: "ambiguous", cid: input.cid, date: input.date, matches: exact.map((row) => brief(row.session, input.date)) },
    };
  }
  if (exact.length === 0) {
    return {
      ok: false,
      status: 409,
      body: { error: `No session on ${input.date} in ${input.cid}.`, reason: "none", cid: input.cid, date: input.date, matches: [], candidates: nearby },
    };
  }
  const target = exact[0]!.session;
  const cleared = input.previouslyOn.length === 0;
  const body = {
    ok: true,
    dryRun: input.dryRun,
    cid: input.cid,
    date: input.date,
    session: brief(target, input.date),
    previouslyOn: cleared ? null : input.previouslyOn,
    cleared,
  };
  if (!input.dryRun) await deps.mergeSession(input.cid, target.id, { previouslyOn: cleared ? null : input.previouslyOn });
  return { ok: true, status: 200, body };
}
