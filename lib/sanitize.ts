/** Minimal recap sanitiser: drop scripts, handlers, and javascript: URLs. Recaps are the group's own notes. */
export function sanitizeRecapHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

export function stripHtml(html: string): string {
  return sanitizeRecapHtml(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
