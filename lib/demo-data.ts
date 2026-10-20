import { cadenceDates, occurrenceInstant } from "./recurrence";
import type { AppState, Attendance, Campaign, Invite, Member, Poll, Session, User } from "./types";

const TZ = "America/Los_Angeles";

const WIZARD_HTML = [
  "<h2>The Wizard of Wines</h2>",
  "<p>Recap by Lizbeth.</p>",
  "<p>The vineyard <strong>burned</strong>. Ichabod kept the gem, and the Abbot smiled far too widely.</p>",
  "<blockquote>We left the winery standing only in name.</blockquote>",
  "<ul><li>The gem stays with Ichabod</li><li>Davian still wants the third gem</li></ul>",
].join("");

const ARGYN_HTML = [
  "<h2>Argynvostholt</h2>",
  "<p>Recap by Seth.</p>",
  "<p>The beacon is lit. The revenants are quieter, not kinder.</p>",
].join("");

export const USERS: User[] = [
  { id: "seth", email: "sthomas131@gmail.com", displayName: "Seth", tz: TZ, calToken: "demo-seth", canCreateCampaigns: true },
  { id: "amy", email: "amy@example.com", displayName: "Amy", tz: TZ, calToken: "demo-amy", canCreateCampaigns: false },
  { id: "ben", email: "ben@example.com", displayName: "Ben", tz: TZ, calToken: "demo-ben", canCreateCampaigns: false },
  { id: "sam", email: "sam@example.com", displayName: "Sam", tz: TZ, calToken: "demo-sam", canCreateCampaigns: false },
  { id: "kai", email: "kai@example.com", displayName: "Kai", tz: TZ, calToken: "demo-kai", canCreateCampaigns: false },
  { id: "giada", email: "giada@example.com", displayName: "Giada", tz: TZ, calToken: "demo-giada", canCreateCampaigns: false },
  { id: "lizbeth", email: "lizbeth@example.com", displayName: "Lizbeth", tz: TZ, calToken: "demo-lizbeth", canCreateCampaigns: false },
];

const HUES: Record<string, number> = { seth: 18, amy: 350, ben: 262, sam: 200, kai: 145, giada: 28, lizbeth: 320 };

function member(id: string, role: Member["role"], extra: Partial<Member> = {}): Member {
  const user = USERS.find((u) => u.id === id)!;
  return {
    id,
    uid: id,
    email: user.email,
    displayName: user.displayName,
    role,
    tags: [],
    hue: HUES[id],
    joinedAt: "2024-10-18T00:00:00.000Z",
    ...extra,
  };
}

function cover(src: string, credit: string): Campaign["cover"] {
  return { src, focalX: 0.5, focalY: 0.42, credit };
}

export const CAMPAIGNS: Campaign[] = [
  {
    id: "strahd",
    orgId: null,
    name: "Curse of Strahd",
    slug: "strahd",
    color: "#ef5350",
    icon: "🧛",
    cover: cover("/covers/abbey.svg", "After Caspar David Friedrich, Abbey in the Oakwood"),
    system: "Dungeons & Dragons",
    defaultLocation: "TPK Brewing, back table",
    tz: TZ,
    ownerUid: "seth",
    status: "active",
    allowMemberInvites: true,
    requireRsvps: false,
    partyLevel: 7,
    previouslyOn: "The vineyard burned, Ichabod kept the gem, and the Abbot smiled far too widely.",
    previouslyOnSessionId: "strahd-2026-10-091830",
    cadence: {
      id: "strahd-series",
      freq: "weeks",
      interval: 2,
      weekday: 5,
      startTime: "18:30",
      durationMin: 240,
      tz: TZ,
      anchorDate: "2026-10-23",
      horizonMonths: 4,
      location: "TPK Brewing, back table",
    },
    rotation: { enabled: true, order: ["ben", "kai", "giada", "sam", "amy", "seth"], nextIndex: 0 },
    discord: null,
  },
  {
    id: "frostmaiden",
    orgId: null,
    name: "Rime of the Frostmaiden",
    slug: "frostmaiden",
    color: "#4fc3f7",
    icon: "❄️",
    cover: cover("/covers/frost.svg", "After Caspar David Friedrich, The Sea of Ice"),
    system: "Dungeons & Dragons",
    defaultLocation: "TPK Brewing",
    tz: TZ,
    ownerUid: "seth",
    status: "active",
    allowMemberInvites: true,
    requireRsvps: false,
    partyLevel: 8,
    previouslyOn: "The whale opened an eye. Nobody agreed on what it meant.",
    cadence: {
      id: "frost-series",
      freq: "weeks",
      interval: 2,
      weekday: 1,
      startTime: "18:30",
      durationMin: 240,
      tz: TZ,
      anchorDate: "2026-10-26",
      horizonMonths: 2,
      location: "TPK Brewing",
    },
    rotation: { enabled: true, order: ["lizbeth", "amy", "seth"], nextIndex: 0 },
    discord: null,
  },
  {
    id: "drawsteel",
    orgId: null,
    name: "Draw Steel: Mini",
    slug: "drawsteel",
    color: "#f5c518",
    icon: "🗡️",
    cover: cover("/covers/storm.svg", "After Albert Bierstadt, A Storm in the Rocky Mountains"),
    system: "Draw Steel",
    defaultLocation: "TPK Brewing",
    tz: TZ,
    ownerUid: "seth",
    status: "active",
    allowMemberInvites: true,
    requireRsvps: false,
    partyLevel: 3,
    cadence: null,
    rotation: { enabled: false, order: [], nextIndex: 0 },
    discord: null,
  },
  {
    id: "leyfarers",
    orgId: null,
    name: "Leyfarers",
    slug: "leyfarers",
    color: "#4caf50",
    icon: "🧭",
    cover: cover("/covers/wilds.svg", "After Albert Bierstadt, Among the Sierra Nevada"),
    system: "Dungeons & Dragons",
    defaultLocation: "TPK Brewing",
    tz: TZ,
    ownerUid: "seth",
    status: "active",
    allowMemberInvites: true,
    requireRsvps: false,
    seatLimit: 6,
    partyLevel: 5,
    cadence: null,
    rotation: { enabled: false, order: [], nextIndex: 0 },
    discord: null,
  },
  {
    id: "beerovia",
    orgId: null,
    name: "Beerovia",
    slug: "beerovia",
    color: "#ff9800",
    icon: "🍺",
    cover: cover("/covers/tavern.svg", "After David Teniers the Younger, Tavern Scene"),
    system: "Dungeons & Dragons",
    defaultLocation: "TPK Brewing",
    tz: TZ,
    ownerUid: "seth",
    status: "active",
    allowMemberInvites: false,
    requireRsvps: false,
    partyLevel: 6,
    cadence: null,
    rotation: { enabled: false, order: [], nextIndex: 0 },
    discord: null,
  },
  {
    id: "special",
    orgId: null,
    name: "One-Shots",
    slug: "special",
    color: "#ce93d8",
    icon: "✨",
    cover: cover("/covers/arcane.svg", "After Joseph Wright of Derby, The Alchemist"),
    defaultLocation: "TPK Brewing",
    tz: TZ,
    ownerUid: "seth",
    status: "active",
    allowMemberInvites: true,
    requireRsvps: true,
    cadence: null,
    rotation: { enabled: false, order: [], nextIndex: 0 },
    discord: null,
  },
];

const STRAHD_PARTY: Member[] = [
  member("seth", "organizer", { tags: ["dm"], characterName: "Seth" }),
  member("amy", "coorganizer", { characterName: "Aralyth" }),
  member("ben", "member", { tags: ["dm"], characterName: "Vloskev" }),
  member("sam", "member", { characterName: "Ichabod" }),
  member("kai", "member", { characterName: "Lysander" }),
  member("giada", "member", { characterName: "Giada" }),
];

const FROST_PARTY: Member[] = [
  member("seth", "organizer", { tags: ["dm"] }),
  member("amy", "member", { characterName: "Aralyth" }),
  member("ben", "member", { characterName: "Vloskev" }),
  member("giada", "member", { characterName: "Giada" }),
  member("lizbeth", "member", { characterName: "Lizbeth" }),
];

const DRAW_PARTY: Member[] = [
  member("seth", "organizer"),
  member("amy", "coorganizer"),
  member("giada", "member"),
  member("sam", "member"),
  member("kai", "member"),
];

const LEY_PARTY: Member[] = [
  member("seth", "organizer", { tags: ["dm"] }),
  member("amy", "member"),
  member("ben", "member"),
  member("sam", "member"),
  member("kai", "member"),
  member("giada", "member"),
];

const BEER_PARTY: Member[] = [
  member("seth", "organizer", { tags: ["dm"] }),
  member("ben", "coorganizer"),
  member("lizbeth", "member"),
  member("sam", "member"),
  member("amy", "member"),
];

const ONE_PARTY: Member[] = [
  member("seth", "organizer"),
  member("giada", "member"),
  member("kai", "member"),
  member("amy", "member"),
];

function makeSession(input: {
  cid: string;
  ymd: string;
  hm: string;
  durationMin: number;
  title: string;
  location: string;
  seriesId?: string | null;
  status?: Session["status"];
  exception?: Session["exception"];
  snackUid?: string | null;
  attendance?: Attendance[];
  recapText?: string;
  recapHtml?: string;
  recapMarkdown?: string;
  pdfPath?: string;
  pdfName?: string;
  pdfUrl?: string;
  notes?: string;
  requireRsvps?: boolean | null;
}): Session {
  const cadence = { interval: 1, weekday: 0, startTime: input.hm, durationMin: input.durationMin, tz: TZ, anchorDate: input.ymd };
  const inst = occurrenceInstant(input.ymd, cadence);
  return {
    id: `${input.cid}-${input.ymd}${input.hm.replace(":", "")}`,
    cid: input.cid,
    seriesId: input.seriesId ?? null,
    occurrenceKey: input.ymd,
    startsAt: inst.startsAt,
    endsAt: inst.endsAt,
    tz: TZ,
    title: input.title,
    location: input.location,
    status: input.status ?? "scheduled",
    exception: input.exception ?? null,
    requireRsvps: input.requireRsvps ?? null,
    snackUid: input.snackUid ?? null,
    seq: input.exception ? 2 : 0,
    attendance: input.attendance ?? [],
    recapText: input.recapText,
    recapHtml: input.recapHtml,
    recapMarkdown: input.recapMarkdown,
    pdfPath: input.pdfPath,
    pdfName: input.pdfName,
    pdfUrl: input.pdfUrl,
    notes: input.notes,
  };
}

const out = (uid: string, by = uid): Attendance => ({
  uid,
  state: "out",
  byUid: by,
  updatedAt: "2026-10-18T18:00:00.000Z",
});

function titledStrahd(ymd: string, indexOnLattice: number): string {
  const special: Record<string, string> = {
    "2026-09-25": "Argynvostholt",
    "2026-10-09": "The Wizard of Wines",
    "2026-10-23": "Session 12 · Into the Amber Temple",
    "2026-11-06": "Session 13",
    "2026-11-20": "Session 14",
    "2026-12-04": "Session 15",
  };
  return special[ymd] ?? `Session ${indexOnLattice + 1}`;
}

function buildSessions(): Session[] {
  const sessions: Session[] = [];
  const strahdDates = cadenceDates(
    { interval: 2, weekday: 5, startTime: "18:30", durationMin: 240, tz: TZ, anchorDate: "2026-10-23" },
    "2025-06-06",
    "2027-02-01",
  );
  const snacks = ["ben", "kai", "giada", "sam", "amy", "seth"];
  strahdDates.forEach((ymd, i) => {
    const cancelled = ymd === "2026-08-14" || ymd === "2025-12-26";
    sessions.push(makeSession({
      cid: "strahd",
      ymd,
      hm: "18:30",
      durationMin: 240,
      title: titledStrahd(ymd, i),
      location: ymd === "2026-11-20" ? "Seth's place" : "TPK Brewing, back table",
      seriesId: "strahd-series",
      status: cancelled ? "cancelled" : "scheduled",
      exception: cancelled ? "skip" : ymd === "2026-11-20" ? "edit" : null,
      snackUid: snacks[i % snacks.length],
      attendance: ymd === "2026-10-23" ? [out("kai")] : [],
      recapText: ymd === "2026-10-09"
        ? "The Wizard of Wines — recap by Lizbeth. The vineyard burned, and the gem stayed with Ichabod."
        : ymd === "2026-09-25"
          ? "Argynvostholt — recap by Seth. The beacon is lit. The revenants are quieter, not kinder."
          : undefined,
      recapHtml: ymd === "2026-10-09" ? WIZARD_HTML : ymd === "2026-09-25" ? ARGYN_HTML : undefined,
      pdfPath: ymd === "2026-10-09" ? "recaps/2026-10-09_Wizard_of_Wines.pdf" : undefined,
      pdfName: ymd === "2026-10-09" ? "Wizard of Wines.pdf" : undefined,
      pdfUrl: ymd === "2026-10-09" ? "/samples/wizard-of-wines.pdf" : undefined,
    }));
  });

  const frostDates = cadenceDates(
    { interval: 2, weekday: 1, startTime: "18:30", durationMin: 240, tz: TZ, anchorDate: "2026-10-26" },
    "2025-06-02",
    "2026-10-26",
  );
  frostDates.forEach((ymd, i) => {
    const upcoming = ymd >= "2026-10-26";
    sessions.push(makeSession({
      cid: "frostmaiden",
      ymd,
      hm: "18:30",
      durationMin: 240,
      title: upcoming ? "Session 13" : `Icewind session`,
      location: "TPK Brewing",
      seriesId: "frost-series",
      snackUid: i % 2 === 0 ? "lizbeth" : "amy",
      status: ymd === "2026-09-14" ? "cancelled" : "scheduled",
      exception: ymd === "2026-09-14" ? "skip" : null,
    }));
  });

  const draw = [
    ["2026-07-08", "Session 1 of 6"],
    ["2026-07-22", "Session 2 of 6"],
    ["2026-08-05", "Session 3 of 6 — moved"],
    ["2026-08-19", "Session 4 of 6"],
    ["2026-10-30", "Session 3 of 6"],
  ] as const;
  for (const [ymd, title] of draw) {
    sessions.push(makeSession({
      cid: "drawsteel",
      ymd,
      hm: ymd === "2026-10-30" ? "19:00" : "18:00",
      durationMin: 180,
      title,
      location: "TPK Brewing",
    }));
  }

  for (const [ymd, title] of [
    ["2026-07-16", "West Marches run"],
    ["2026-07-30", "West Marches run"],
    ["2026-08-27", "West Marches run"],
    ["2026-11-09", "West Marches run"],
  ] as const) {
    sessions.push(makeSession({
      cid: "leyfarers",
      ymd,
      hm: "18:30",
      durationMin: 240,
      title,
      location: "TPK Brewing",
      attendance: ymd === "2026-11-09" ? [out("sam"), out("kai")] : [],
    }));
  }

  for (const [ymd, title] of [
    ["2026-08-24", "The Tithe"],
    ["2026-09-11", "Blood o' the Vine"],
    ["2026-11-13", "Session 8"],
  ] as const) {
    sessions.push(makeSession({
      cid: "beerovia",
      ymd,
      hm: ymd === "2026-11-13" ? "19:00" : "18:00",
      durationMin: 240,
      title,
      location: "TPK Brewing",
    }));
  }

  sessions.push(makeSession({
    cid: "special",
    ymd: "2026-06-20",
    hm: "17:00",
    durationMin: 240,
    title: "A night with no campaign",
    location: "TPK Brewing",
    requireRsvps: true,
  }));

  // A handful of early nights so the anniversary reaches back to 2024.
  for (const ymd of ["2024-10-25", "2024-12-06", "2025-02-14", "2025-04-04"]) {
    sessions.push(makeSession({
      cid: "strahd",
      ymd,
      hm: "18:30",
      durationMin: 240,
      title: "Early night in Barovia",
      location: "TPK Brewing, back table",
      seriesId: "strahd-series",
    }));
  }
  return sessions;
}

function pollOption(id: string, ymd: string, hm: string): Poll["options"][number] {
  const inst = occurrenceInstant(ymd, { interval: 1, weekday: 0, startTime: hm, durationMin: 240, tz: TZ, anchorDate: ymd });
  return { id, startsAt: inst.startsAt, endsAt: inst.endsAt, tz: TZ };
}

const POLL_DATES = ["2026-12-04", "2026-12-07", "2026-12-11", "2026-12-12", "2026-12-14"];
const POLL_TIMES = ["14:00", "16:00", "18:00", "19:00", "20:00"];

function buildPoll(): Poll {
  const options = POLL_DATES.flatMap((ymd) => POLL_TIMES.map((hm) => pollOption(`${ymd}-${hm}`, ymd, hm)));
  const yes = (ids: string[]) => ({ picks: Object.fromEntries(ids.map((id) => [id, true])), updatedAt: "2026-10-19T00:00:00.000Z" });
  return {
    id: "frost-dec",
    cid: "frostmaiden",
    title: "Frostmaiden · December dates",
    options,
    status: "open",
    createdBy: "seth",
    closesAt: "2026-11-20T08:00:00.000Z",
    nudges: {},
    votes: {
      seth: yes(["2026-12-07-18:00", "2026-12-07-19:00", "2026-12-04-18:00", "2026-12-11-18:00", "2026-12-12-14:00", "2026-12-12-18:00", "2026-12-12-19:00", "2026-12-14-18:00"]),
      amy: yes(["2026-12-07-18:00", "2026-12-04-18:00", "2026-12-11-18:00", "2026-12-11-16:00", "2026-12-12-18:00", "2026-12-14-18:00", "2026-12-07-16:00"]),
      ben: yes(["2026-12-07-18:00", "2026-12-07-19:00", "2026-12-11-14:00", "2026-12-12-20:00", "2026-12-04-18:00", "2026-12-14-18:00", "2026-12-11-18:00"]),
      giada: yes(["2026-12-07-18:00", "2026-12-07-19:00", "2026-12-11-19:00", "2026-12-04-19:00", "2026-12-12-16:00", "2026-12-12-19:00"]),
    },
  };
}

const INVITES: Invite[] = [
  {
    token: "beerovia-demo",
    cid: "beerovia",
    email: "giada@example.com",
    role: "member",
    createdBy: "seth",
    createdByName: "Seth",
    expiresAt: "2026-11-15T00:00:00.000Z",
    maxUses: 1,
    uses: 0,
    status: "pending",
  },
];

export function buildDemo(personaId = "giada"): AppState {
  const me = USERS.find((u) => u.id === personaId) ?? USERS.find((u) => u.id === "giada")!;
  return {
    me,
    directory: USERS,
    campaigns: CAMPAIGNS.map((c) => ({ ...c, cadence: c.cadence ? { ...c.cadence } : null, rotation: { ...c.rotation, order: [...c.rotation.order] } })),
    sessions: buildSessions(),
    members: {
      strahd: STRAHD_PARTY.map((m) => ({ ...m })),
      frostmaiden: FROST_PARTY.map((m) => ({ ...m })),
      drawsteel: DRAW_PARTY.map((m) => ({ ...m })),
      leyfarers: LEY_PARTY.map((m) => ({ ...m })),
      beerovia: BEER_PARTY.map((m) => ({ ...m })),
      special: ONE_PARTY.map((m) => ({ ...m })),
    },
    polls: [buildPoll()],
    invites: INVITES.map((i) => ({ ...i })),
    hiddenCids: ["special"],
    groupStartedOn: "2024-10-18",
  };
}

export function freshDemo(personaId = "giada"): AppState {
  return buildDemo(personaId);
}
