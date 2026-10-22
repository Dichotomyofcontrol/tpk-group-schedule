import { recapPlain } from "./recap";
import type { Session } from "./types";

/** Per-device "have I read this recap" marks. A changed recap counts as new again. */
const KEY = "tpk-read-recaps";

export function recapSig(s: Session): string {
  return `${recapPlain(s).length}:${s.pdfPath || ""}`;
}

function load(): Record<string, string> | null {
  try { const raw = window.localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

/** First visit on this device: everything already written counts as read, so old recaps don't all light up. */
export function seedReads(sessions: Session[]): void {
  if (load()) return;
  const marks: Record<string, string> = {};
  for (const s of sessions) marks[s.id] = recapSig(s);
  try { window.localStorage.setItem(KEY, JSON.stringify(marks)); } catch { /* private mode */ }
}

export function isUnread(s: Session): boolean {
  const marks = load();
  if (!marks) return false;
  return marks[s.id] !== recapSig(s);
}

export function markRead(s: Session): void {
  const marks = load() || {};
  marks[s.id] = recapSig(s);
  try { window.localStorage.setItem(KEY, JSON.stringify(marks)); } catch { /* private mode */ }
}

export function readingMinutes(s: Session): number {
  const words = recapPlain(s).trim().split(/\s+/).filter(Boolean).length;
  return words ? Math.max(1, Math.round(words / 220)) : 0;
}
