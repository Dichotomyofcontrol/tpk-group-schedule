import { cadenceDates, occurrenceInstant } from "./recurrence";
import type { AppState, Attendance, Campaign, CharacterSummary, Invite, Member, Poll, Session, TableCharacter, User } from "./types";

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

/** About two minutes aloud. Pushed onto the next Icewind night the way the import route would. */
const FROST_OPENER = [
  "Last time, the whale opened an eye under the ice, and nobody at the table agreed on what it meant. Auril's aurora still hangs over Ten-Towns. You left Easthaven with the cauldron shards wrapped in sailcloth, Sephek's blade cold in the boat, and a promise to the speaker that you would be back before the next new moon.",
  "",
  "The chwinga that followed you from the ferry is still in Vellynne's hood. She will not say why. She will say, if someone asks her tonight, that the island of Solstice is closer than the map admits, and that the tests there are not metaphors. The duergar plot in Easthaven is not finished. The speaker knows their faces. The cauldron is still in three pieces.",
  "",
  "You rowed out at dusk. The water was the color of ink, and the light under the ice kept pace with the boat. Name who sat where: who held the shards, who watched the shore, who would not look down. Give the table a breath. Then give them the night. The island is a black line on the horizon. The cold has a voice in it. Something large blinked, once, and the aurora answered.",
  "",
  "If they argue about the whale, let them. That argument is how this night starts. When it settles, remind them of the promise, the three pieces of the cauldron, and the tests that are not metaphors. Then deal the first scene: the rowboat, the dark water, and the light that will not let them pass.",
].join("\n");

export const USERS: User[] = [
  { id: "seth", email: "sthomas131@gmail.com", displayName: "Seth", tz: TZ, calToken: "demo-seth", canCreateCampaigns: true, nameSet: true },
  { id: "amy", email: "amy@example.com", displayName: "Amy", tz: TZ, calToken: "demo-amy", canCreateCampaigns: false, nameSet: true },
  { id: "ben", email: "ben@example.com", displayName: "Ben", tz: TZ, calToken: "demo-ben", canCreateCampaigns: false, nameSet: true },
  { id: "sam", email: "sam@example.com", displayName: "Sam", tz: TZ, calToken: "demo-sam", canCreateCampaigns: false, nameSet: true },
  { id: "kai", email: "kai@example.com", displayName: "Kai", tz: TZ, calToken: "demo-kai", canCreateCampaigns: false, nameSet: true },
  { id: "giada", email: "giada@example.com", displayName: "Giada", tz: TZ, calToken: "demo-giada", canCreateCampaigns: false, nameSet: true },
  { id: "lizbeth", email: "lizbeth@example.com", displayName: "Lizbeth", tz: TZ, calToken: "demo-lizbeth", canCreateCampaigns: false, nameSet: true },
  { id: "newcomer", email: "new@example.com", displayName: "New", tz: TZ, calToken: "demo-new", canCreateCampaigns: false, nameSet: true },
  { id: "neworg", email: "neworg@example.com", displayName: "Nova", tz: TZ, calToken: "demo-neworg", canCreateCampaigns: true, nameSet: true },
];

const HUES: Record<string, number> = { seth: 18, amy: 350, ben: 262, sam: 200, kai: 145, giada: 28, lizbeth: 320, newcomer: 210, neworg: 170 };

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
    discord: null,
    roster: ["Aralyth", "Vloskev", "Ichabod", "Lysander", "Lizbeth", "Giada"],
    characters: [
      { name: "Aralyth", charClass: "Paladin", level: "3" },
      { name: "Vloskev", charClass: "Rogue", subclass: "Medic", level: "3", ownerEmail: "sthomas131@gmail.com" },
      { name: "Ichabod", charClass: "Fighter", level: "3" },
      { name: "Lysander", charClass: "Artificer", level: "3" },
      { name: "Lizbeth", charClass: "Monk", level: "3" },
      { name: "Giada", charClass: "Wizard", subclass: "Divination", level: "3" },
    ] satisfies TableCharacter[],
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
    discord: null,
    roster: ["Ryn", "Oli", "Cooter", "Rosie", "Gordo"],
    characters: [
      { name: "Ryn", charClass: "Fighter", subclass: "Rune Knight", level: "8", ownerEmail: "sthomas131@gmail.com", imagePath: "recaps/avatars/frostmaiden_Ryn.png" },
      { name: "Oli", charClass: "Sorcerer", subclass: "Spellfire", level: "8" },
      { name: "Cooter", charClass: "Ranger / Rogue", subclass: "Gloomstalker / Scout", level: "8" },
      { name: "Rosie", charClass: "Druid / Cleric", level: "8" },
      { name: "Gordo", charClass: "Cleric", subclass: "Light", level: "8" },
    ] satisfies TableCharacter[],
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
    discord: null,
  },
  {
    id: "saltmarsh",
    orgId: null,
    name: "Ghosts of Saltmarsh",
    slug: "saltmarsh",
    color: "#26a69a",
    icon: "⚓",
    cover: cover("/covers/wilds.svg", "After Ivan Aivazovsky, The Ninth Wave"),
    system: "Dungeons & Dragons",
    defaultLocation: "TPK Brewing",
    tz: TZ,
    ownerUid: "seth",
    status: "active",
    allowMemberInvites: false,
    requireRsvps: false,
    cadence: null,
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
  attendance?: Attendance[];
  recapText?: string;
  recapHtml?: string;
  recapMarkdown?: string;
  pdfPath?: string;
  pdfName?: string;
  pdfUrl?: string;
  notes?: string;
  previouslyOn?: string;
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
    seq: input.exception ? 2 : 0,
    attendance: input.attendance ?? [],
    recapText: input.recapText,
    recapHtml: input.recapHtml,
    recapMarkdown: input.recapMarkdown,
    pdfPath: input.pdfPath,
    pdfName: input.pdfName,
    pdfUrl: input.pdfUrl,
    notes: input.notes,
    previouslyOn: input.previouslyOn,
  };
}

const out = (uid: string, by = uid): Attendance => ({
  uid,
  state: "out",
  byUid: by,
  updatedAt: "2026-10-18T18:00:00.000Z",
});

function titledStrahd(ymd: string, indexOnLattice: number): string | null {
  const special: Record<string, string> = {
    "2026-09-25": "Argynvostholt",
    "2026-10-09": "The Wizard of Wines",
    "2026-10-23": "Session 12 · Into the Amber Temple",
    "2026-11-06": "Session 13",
    "2026-11-20": "Session 14",
    "2026-12-04": "Session 15",
  };
  if (special[ymd]) return special[ymd];
  if (ymd > "2026-12-04") return null;
  return `Session ${indexOnLattice + 1}`;
}

function buildSessions(): Session[] {
  const sessions: Session[] = [];
  const strahdDates = cadenceDates(
    { interval: 2, weekday: 5, startTime: "18:30", durationMin: 240, tz: TZ, anchorDate: "2026-10-23" },
    "2025-06-06",
    "2027-02-01",
  );
  let afterFifteen = 16;
  strahdDates.forEach((ymd, i) => {
    const cancelled = ymd === "2026-08-14" || ymd === "2025-12-26";
    const named = titledStrahd(ymd, i);
    sessions.push(makeSession({
      cid: "strahd",
      ymd,
      hm: "18:30",
      durationMin: 240,
      title: named ?? `Session ${afterFifteen++}`,
      location: ymd === "2026-11-20" ? "Seth's place" : "TPK Brewing, back table",
      seriesId: "strahd-series",
      status: cancelled ? "cancelled" : "scheduled",
      exception: cancelled ? "skip" : ymd === "2026-11-20" ? "edit" : null,
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
      status: ymd === "2026-09-14" ? "cancelled" : "scheduled",
      exception: ymd === "2026-09-14" ? "skip" : null,
      previouslyOn: ymd === "2026-10-26" ? FROST_OPENER : undefined,
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

function saltPoll(): Poll {
  return {
    id: "salt-dates",
    cid: "saltmarsh",
    title: "Options?",
    options: [
      pollOption("2026-11-21-18:00", "2026-11-21", "18:00"),
      pollOption("2026-11-29-18:00", "2026-11-29", "18:00"),
      pollOption("2026-12-19-14:00", "2026-12-19", "14:00"),
    ],
    status: "open",
    createdBy: "seth",
    votes: {},
    nudges: {},
  };
}

function amyOpenPoll(): Poll {
  return {
    id: "frost-amy",
    cid: "frostmaiden",
    title: "Icewind weekend",
    options: [
      pollOption("2026-12-05-18:00", "2026-12-05", "18:00"),
      pollOption("2026-12-06-14:00", "2026-12-06", "14:00"),
    ],
    status: "open",
    createdBy: "amy",
    votes: {
      amy: { picks: { "2026-12-05-18:00": true }, updatedAt: "2026-10-20T00:00:00.000Z" },
      giada: { picks: { "2026-12-05-18:00": true, "2026-12-06-14:00": true }, updatedAt: "2026-10-20T00:00:00.000Z" },
    },
  };
}

function sethLockedPoll(): Poll {
  const chosen = "2026-11-07-18:30";
  return {
    id: "strahd-lock",
    cid: "strahd",
    title: "Barovia makeup night",
    options: [
      pollOption(chosen, "2026-11-07", "18:30"),
      pollOption("2026-11-08-18:30", "2026-11-08", "18:30"),
    ],
    status: "locked",
    chosenOptionId: chosen,
    createdBy: "seth",
    votes: {
      seth: { picks: { [chosen]: true }, updatedAt: "2026-10-01T00:00:00.000Z" },
      amy: { picks: { [chosen]: true }, updatedAt: "2026-10-01T00:00:00.000Z" },
      ben: { picks: { "2026-11-08-18:30": true }, updatedAt: "2026-10-01T00:00:00.000Z" },
    },
  };
}

function amyLockedPoll(): Poll {
  const chosen = "2026-10-18-19:00";
  return {
    id: "ley-lock",
    cid: "leyfarers",
    title: "Leyfarers · October",
    options: [
      pollOption(chosen, "2026-10-18", "19:00"),
      pollOption("2026-10-25-19:00", "2026-10-25", "19:00"),
      pollOption("2026-11-01-19:00", "2026-11-01", "19:00"),
    ],
    status: "locked",
    chosenOptionId: chosen,
    createdBy: "amy",
    votes: {
      amy: { picks: { [chosen]: true }, updatedAt: "2026-10-10T00:00:00.000Z" },
      seth: { picks: { [chosen]: true, "2026-10-25-19:00": true }, updatedAt: "2026-10-10T00:00:00.000Z" },
    },
  };
}

function buildPoll(): Poll {
  const options = POLL_DATES.flatMap((ymd) => POLL_TIMES.map((hm) => pollOption(`${ymd}-${hm}`, ymd, hm)));
  const yes = (ids: string[], best: string[] = []) => {
    const favorites = new Set(best);
    const picks: Record<string, boolean | "best"> = {};
    for (const id of ids) picks[id] = favorites.has(id) ? "best" : true;
    return { picks, updatedAt: "2026-10-19T00:00:00.000Z" };
  };
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
      seth: yes(["2026-12-07-18:00", "2026-12-07-19:00", "2026-12-04-18:00", "2026-12-11-18:00", "2026-12-12-14:00", "2026-12-12-18:00", "2026-12-12-19:00", "2026-12-14-18:00"], ["2026-12-07-18:00"]),
      amy: yes(["2026-12-07-18:00", "2026-12-04-18:00", "2026-12-11-18:00", "2026-12-11-16:00", "2026-12-12-18:00", "2026-12-14-18:00", "2026-12-07-16:00"], ["2026-12-07-18:00"]),
      ben: yes(["2026-12-07-18:00", "2026-12-07-19:00", "2026-12-11-14:00", "2026-12-12-20:00", "2026-12-04-18:00", "2026-12-14-18:00", "2026-12-11-18:00"], ["2026-12-07-18:00"]),
      giada: yes(["2026-12-07-18:00", "2026-12-07-19:00", "2026-12-11-19:00", "2026-12-04-19:00", "2026-12-12-16:00", "2026-12-12-19:00"]),
      lizbeth: yes(["2026-12-07-18:00"]),
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
    campaigns: CAMPAIGNS.map((c) => ({ ...c, cadence: c.cadence ? { ...c.cadence } : null })),
    sessions: buildSessions(),
    members: {
      strahd: STRAHD_PARTY.map((m) => ({ ...m })),
      frostmaiden: FROST_PARTY.map((m) => ({ ...m })),
      drawsteel: DRAW_PARTY.map((m) => ({ ...m })),
      leyfarers: LEY_PARTY.map((m) => ({ ...m })),
      beerovia: BEER_PARTY.map((m) => ({ ...m })),
      special: ONE_PARTY.map((m) => ({ ...m })),
      saltmarsh: [member("seth", "organizer", { tags: ["dm"] })],
    },
    polls: [saltPoll(), buildPoll(), amyOpenPoll(), sethLockedPoll(), amyLockedPoll()],
    invites: INVITES.map((i) => ({ ...i })),
    hiddenCids: ["special"],
    characterSummaries: { strahd: strahdSummaries() },
    groupStartedOn: "2024-10-18",
  };
}

export function freshDemo(personaId = "giada"): AppState {
  return buildDemo(personaId);
}

const PENDING_AT = "2026-10-01T00:00:00.000Z";

function pendingSummary(name: string): CharacterSummary {
  return { name, status: "pending", updatedAt: PENDING_AT };
}

/** Ichabod's prose is stored fixture data, the way the Archivist would write it. Nothing here calls a model. */
function strahdSummaries(): CharacterSummary[] {
  return [
    pendingSummary("Aralyth"),
    pendingSummary("Vloskev"),
    pendingSummary("Lysander"),
    pendingSummary("Lizbeth"),
    pendingSummary("Giada"),
    {
      name: "Ichabod",
      status: "ready",
      updatedAt: "2026-10-10T00:00:00.000Z",
      text: "Ichabod carries the third gem from the Wizard of Wines and will not hand it over. He stands at the front when the road turns hostile, quieter since the vineyard burned. The Abbot's smile stayed with him longer than the smoke. The rest of the party has learned not to ask what the gem is for.",
      facts: {
        class: "Fighter",
        ancestry: "Human",
        role: "Holds the front, and the gem",
        moment: "Kept the gem when the vineyard burned",
      },
    },
  ];
}
