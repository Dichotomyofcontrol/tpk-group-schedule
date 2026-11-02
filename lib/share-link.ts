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

/** A ready-to-send note naming who hasn't voted, with the poll link in the message. */
export function pollReminderMessage(names: string[], campaignName: string, url: string): string {
  const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] || "friends";
  return `${who}: we're picking the next ${campaignName} night. Tap the dates that work for you: ${url}`;
}

function proseWithoutLink(text: string | undefined, url: string): string {
  if (!text) return "";
  const stripped = url ? text.split(url).join(" ") : text;
  return stripped.replace(/\s+/g, " ").trim().replace(/[:\-–—]\s*$/, "").trim();
}

/** Short plain group-chat note for a locked date: campaign, date, time, place, link. */
export function lockedDateMessage(input: { campaignName: string; startsAt: string; endsAt?: string | null; tz: string; location?: string | null; url: string }): string {
  const start = new Date(input.startsAt);
  const date = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: input.tz }).format(start);
  const t = (d: Date) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: input.tz }).format(d).replace(":00", "");
  const end = input.endsAt ? new Date(input.endsAt) : null;
  const time = end && end.getTime() > start.getTime() ? `${t(start)}–${t(end)}` : t(start);
  const lines = [`${input.campaignName} is on: ${date}, ${time}`];
  if (input.location?.trim()) lines.push(`Where: ${input.location.trim()}`);
  lines.push(input.url);
  return lines.join("\n");
}
