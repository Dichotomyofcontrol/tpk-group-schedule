/**
 * Payload for the system share sheet.
 * Targets such as iOS Messages append `url` to `text`, so a text that
 * already contains the link pastes it twice. The link lives only in `url`.
 */
export type LinkShareData = { title: string; url: string; text?: string };

export function linkShareData(title: string, url: string, text?: string): LinkShareData {
  const note = proseWithoutLink(text, url);
  if (!note) return { title, url };
  return { title, text: note, url };
}

/** How many times the link appears across the fields a share sheet concatenates. */
export function linkCount(data: LinkShareData): number {
  if (!data.url) return 0;
  return `${data.text || ""}\n${data.url}`.split(data.url).length - 1;
}

function proseWithoutLink(text: string | undefined, url: string): string {
  if (!text) return "";
  const stripped = url ? text.split(url).join(" ") : text;
  return stripped.replace(/\s+/g, " ").trim().replace(/[:\-–—]\s*$/, "").trim();
}
