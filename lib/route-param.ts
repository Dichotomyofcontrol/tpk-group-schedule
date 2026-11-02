/**
 * Next.js hands dynamic route params to pages still percent-encoded (":" arrives as "%3A").
 * Ids are stored decoded, so decode before matching. A malformed escape falls back to the raw value.
 */
export function routeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Characters allowed in ids we mint ourselves, so they never need URL escaping. */
export function safeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "");
}
