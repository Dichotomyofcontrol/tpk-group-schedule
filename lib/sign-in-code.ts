import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/** Short enough that a missed email is not a lingering credential. */
export const SIGNIN_CODE_TTL_MS = 15 * 60 * 1000;
export const SIGNIN_CODE_MAX_ATTEMPTS = 5;

export type SignInCodeRecord = {
  email: string;
  codeHash: string;
  link: string;
  expiresAt: number;
  attempts: number;
};

export type SignInCodeResult = { ok: true; link: string } | { ok: false; error: "invalid" | "expired" };

export function generateSignInCode(nextInt: (max: number) => number = (max) => randomInt(max)): string {
  return nextInt(1_000_000).toString().padStart(6, "0");
}

export function parseSignInCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

export function signInCodeDocId(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function hashSignInCode(email: string, code: string): string {
  return createHash("sha256").update(`${email.trim().toLowerCase()}:${code}`).digest("hex");
}

export function signInCodesMatch(email: string, code: string, hash: string): boolean {
  const next = Buffer.from(hashSignInCode(email, code), "hex");
  const prev = Buffer.from(hash, "hex");
  if (next.length === 0 || next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

/**
 * One active code per email. A correct code is deleted (single use).
 * Too many misses or an expired record are deleted too.
 */
export function decideSignInCode(record: SignInCodeRecord | null, email: string, code: string, now: number): {
  result: SignInCodeResult;
  /** Null deletes the record. Undefined leaves it untouched. */
  next: SignInCodeRecord | null | undefined;
} {
  if (!record || record.email !== email.trim().toLowerCase()) return { result: { ok: false, error: "invalid" }, next: undefined };
  if (record.expiresAt <= now) return { result: { ok: false, error: "expired" }, next: null };
  if (record.attempts >= SIGNIN_CODE_MAX_ATTEMPTS) return { result: { ok: false, error: "expired" }, next: null };
  if (!signInCodesMatch(email, code, record.codeHash)) {
    const attempts = record.attempts + 1;
    if (attempts >= SIGNIN_CODE_MAX_ATTEMPTS) return { result: { ok: false, error: "invalid" }, next: null };
    return { result: { ok: false, error: "invalid" }, next: { ...record, attempts } };
  }
  return { result: { ok: true, link: record.link }, next: null };
}

/** In-memory stand-in for the Firestore transaction, used by unit tests. */
export class MemorySignInCodes {
  private rows = new Map<string, SignInCodeRecord>();

  save(record: SignInCodeRecord): void {
    this.rows.set(signInCodeDocId(record.email), record);
  }

  redeem(email: string, code: string, now = Date.now()): SignInCodeResult {
    const id = signInCodeDocId(email);
    const decision = decideSignInCode(this.rows.get(id) ?? null, email, code, now);
    if (decision.next === null) this.rows.delete(id);
    else if (decision.next) this.rows.set(id, decision.next);
    return decision.result;
  }

  has(email: string): boolean {
    return this.rows.has(signInCodeDocId(email));
  }
}
