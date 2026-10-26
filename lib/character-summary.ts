import { recapPlain } from "./recap";
import type { AppState, CharacterFacts, CharacterSummary, Session } from "./types";

const FACT_KEYS = ["class", "ancestry", "role", "moment"] as const;
const TEXT_MAX = 1200;
const FACT_MAX = 80;

export function summaryDocId(name: string): string {
  const slug = name.trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return slug || "character";
}

export function findSummary(list: CharacterSummary[] | undefined, name: string): CharacterSummary | undefined {
  const id = summaryDocId(name);
  return list?.find((item) => summaryDocId(item.name) === id);
}

/** A name with no stored record is pending. Nothing here writes prose. */
export function summaryFor(list: CharacterSummary[] | undefined, name: string): CharacterSummary {
  const clean = name.trim();
  return findSummary(list, clean) ?? { name: clean, status: "pending", updatedAt: "" };
}

/** Remember a character name without inventing its summary. A ready summary stays ready. */
export function notePending(list: CharacterSummary[], name: string, now = new Date()): CharacterSummary[] {
  const clean = name.trim();
  if (!clean || findSummary(list, clean)) return list;
  return [...list, { name: clean, status: "pending", updatedAt: now.toISOString() }];
}

export function rememberCharacter(state: AppState, cid: string, name: string, now = new Date()): AppState {
  const current = state.characterSummaries?.[cid] ?? [];
  const next = notePending(current, name, now);
  if (next === current) return state;
  return { ...state, characterSummaries: { ...state.characterSummaries, [cid]: next } };
}

export type SummaryWrite = {
  cid: string;
  name: string;
  text: string;
  facts: Required<CharacterFacts>;
};

export function parseSummaryWrite(body: unknown): { ok: true; value: SummaryWrite } | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") return { ok: false, status: 400, error: "Send JSON." };
  const raw = body as Record<string, unknown>;
  const cid = typeof raw.cid === "string" ? raw.cid.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!cid || !/^[A-Za-z0-9_-]{1,80}$/.test(cid)) return { ok: false, status: 400, error: "Name the campaign." };
  if (!name || name.length > 60) return { ok: false, status: 400, error: "Name the character." };
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  if (sentences.length < 3 || sentences.length > 4) return { ok: false, status: 400, error: "Write three or four sentences." };
  if (text.length > TEXT_MAX) return { ok: false, status: 400, error: "That summary is too long." };
  const factsIn = raw.facts && typeof raw.facts === "object" ? raw.facts as Record<string, unknown> : {};
  const facts = {} as Required<CharacterFacts>;
  for (const key of FACT_KEYS) {
    const value = typeof factsIn[key] === "string" ? factsIn[key].trim() : "";
    if (!value || value.length > FACT_MAX) return { ok: false, status: 400, error: `Add a short ${key}.` };
    facts[key] = value;
  }
  return { ok: true, value: { cid, name, text, facts } };
}

export function readySummary(value: SummaryWrite, now = new Date()): CharacterSummary {
  return { name: value.name, status: "ready", text: value.text, facts: value.facts, updatedAt: now.toISOString() };
}

export function summaryFromDoc(data: Record<string, unknown>, fallbackName: string): CharacterSummary | null {
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : fallbackName;
  if (!name) return null;
  const updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : "";
  const text = typeof data.text === "string" ? data.text.trim() : "";
  const facts = factsFrom(data.facts);
  if (data.status === "ready" && text) return { name, status: "ready", text, facts, updatedAt };
  return { name, status: "pending", updatedAt };
}

export type Appearance = { id: string; cid: string; title: string; startsAt: string; tz: string };

export function recapAppearances(sessions: Session[], cid: string, name: string): Appearance[] {
  const clean = name.trim();
  if (!clean) return [];
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  return sessions
    .filter((session) => session.cid === cid && session.status !== "cancelled" && re.test(recapPlain(session)))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .map((session) => ({
      id: session.id,
      cid: session.cid,
      title: session.title.trim() || "Session",
      startsAt: session.startsAt,
      tz: session.tz,
    }));
}

function factsFrom(raw: unknown): CharacterFacts | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as Record<string, unknown>;
  const facts: CharacterFacts = {};
  for (const key of FACT_KEYS) {
    const value = typeof source[key] === "string" ? source[key].trim() : "";
    if (value) facts[key] = value.slice(0, FACT_MAX);
  }
  return Object.keys(facts).length ? facts : undefined;
}
