/** Drop keys whose value is undefined, recursively. Firestore rejects undefined. Null stays. */
export function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => omitUndefined(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue;
      out[key] = omitUndefined(item);
    }
    return out as T;
  }
  return value;
}

export function containsUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(containsUndefined);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(containsUndefined);
  }
  return false;
}
