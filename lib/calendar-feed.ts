import { attendanceState } from "./attendance";
import { buildDemo } from "./demo-data";
import { buildIcs, type IcsEvent } from "./ics";

export function demoFeed(token: string, cid?: string, hide: string[] = []): string | null {
  const persona = token.replace(/\.ics$/, "").replace(/^demo-/, "");
  const known = buildDemo(persona);
  if (!known.directory.some((user) => user.id === persona)) return null;
  const hidden = new Set(hide.filter(Boolean));
  const memberOf = new Set(
    Object.entries(known.members)
      .filter(([, members]) => members.some((member) => member.id === persona))
      .map(([id]) => id),
  );
  const events: IcsEvent[] = [];
  for (const session of known.sessions) {
    if (!memberOf.has(session.cid)) continue;
    if (cid && session.cid !== cid) continue;
    if (hidden.has(session.cid)) continue;
    const campaign = known.campaigns.find((item) => item.id === session.cid);
    if (!campaign) continue;
    events.push({
      session,
      campaign,
      viewerOut: attendanceState(campaign, session, persona) === "out",
    });
  }
  const name = cid ? known.campaigns.find((item) => item.id === cid)?.name || "Play dates" : "Six in the TPK";
  return buildIcs(name, events);
}

export function calendarHeaders(): HeadersInit {
  return {
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": "public, s-maxage=900, max-age=300",
  };
}
