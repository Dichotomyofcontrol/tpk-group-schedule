/** Fixed-window rate limit. Uses Firestore when an admin db is given (shared across instances), else in-memory. */
import type { Firestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";

const memory = new Map<string, { count: number; reset: number }>();

export function hitMemory(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const entry = memory.get(key);
  if (!entry || now >= entry.reset) {
    memory.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function resetMemoryLimits() { memory.clear(); }

export async function hit(db: Firestore | null, key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!db) return hitMemory(key, limit, windowMs);
  const id = createHash("sha256").update(key).digest("hex").slice(0, 40);
  const ref = db.collection("rateLimits").doc(id);
  try {
    return await db.runTransaction(async (tx) => {
      const now = Date.now();
      const snap = await tx.get(ref);
      const data = snap.data() as { count?: number; reset?: number } | undefined;
      if (!data || !data.reset || now >= data.reset) {
        tx.set(ref, { count: 1, reset: now + windowMs, expireAt: new Date(now + windowMs) });
        return true;
      }
      const count = (data.count || 0) + 1;
      tx.update(ref, { count });
      return count <= limit;
    });
  } catch {
    return hitMemory(key, limit, windowMs);
  }
}
