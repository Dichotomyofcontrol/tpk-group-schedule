import { toIcsUtc } from "./time";
import type { Campaign, Session } from "./types";

function esc(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = " " + rest.slice(73);
  }
  out.push(rest);
  return out.join("\r\n");
}

export type IcsEvent = {
  session: Session;
  campaign: Campaign;
  /** Feed owner is marked out — keep the event, say so in the title. */
  viewerOut?: boolean;
};

export function buildIcs(name: string, events: IcsEvent[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Six in the TPK//Sessions//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "X-WR-CALDESC:Only nights you play.",
    `X-WR-TIMEZONE:UTC`,
  ];
  for (const event of events) {
    const { session, campaign } = event;
    const summary = event.viewerOut ? `Out · ${campaign.name}` : `${campaign.name} — ${session.title}`;
    const description = [
      session.title,
      session.location,
      campaign.previouslyOn ? `Previously on: ${campaign.previouslyOn}` : "",
      "From Six in the TPK",
    ].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${session.id}@sixinthetpk.com`);
    lines.push(`DTSTAMP:${toIcsUtc(now.toISOString())}`);
    lines.push(`DTSTART:${toIcsUtc(session.startsAt)}`);
    lines.push(`DTEND:${toIcsUtc(session.endsAt)}`);
    lines.push(`SUMMARY:${esc(summary)}`);
    if (session.location) lines.push(`LOCATION:${esc(session.location)}`);
    lines.push(`DESCRIPTION:${esc(description)}`);
    lines.push(`STATUS:${session.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`);
    lines.push(`SEQUENCE:${session.seq}`);
    lines.push(`CATEGORIES:${esc(campaign.name)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarSubscribe(webcalUrl: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;
}

export function googleEventTemplate(session: Session, campaign: Campaign): string {
  const dates = `${toIcsUtc(session.startsAt)}/${toIcsUtc(session.endsAt)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${campaign.name} — ${session.title}`,
    dates,
    location: session.location || "",
    details: campaign.previouslyOn ? `Previously on: ${campaign.previouslyOn}` : "Six in the TPK",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
