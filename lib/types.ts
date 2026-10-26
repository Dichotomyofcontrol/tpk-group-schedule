export type Role = "organizer" | "coorganizer" | "member";

/** A table character from the old characters/rosters docs. Not an account. */
export type TableCharacter = {
  name: string;
  charClass?: string;
  subclass?: string;
  level?: string;
  /** Email on the old character sheet. Not turned into a member. */
  ownerEmail?: string;
  /** Storage path for a portrait. Never a download-token URL. */
  imagePath?: string;
  leyfarer?: boolean;
};

export type SessionFile = {
  path: string;
  name: string;
  /** Bytes, when known (new uploads). */
  size?: number;
  /** Page count, when known (new uploads). */
  pages?: number;
};

export type Member = {
  id: string;
  uid?: string;
  email: string;
  displayName: string;
  characterName?: string;
  /** Optional hue used when no uploaded portrait exists. */
  hue?: number;
  role: Role;
  /** Optional labels such as "dm". Never grants permissions. */
  tags: string[];
  joinedAt: string;
  /** Reserved for a future Discord bot. Unused in v1. */
  discordUserId?: string;
  pending?: boolean;
  /** True when this player turned off reminder emails for this campaign. */
  remindersOff?: boolean;
};

export type Cadence = {
  id: string;
  freq: "weeks";
  /** 1 = every week, 2 = every other week. */
  interval: number;
  /** 0 Sunday … 6 Saturday, in the cadence time zone. */
  weekday: number;
  /** 24h wall-clock time, HH:mm. */
  startTime: string;
  durationMin: number;
  tz: string;
  /** A known occurrence, YYYY-MM-DD in `tz`. */
  anchorDate: string;
  horizonMonths: number;
  location: string;
};

export type Campaign = {
  id: string;
  /** Reserved so a venue or other organizer can exist later. Null for Seth's tables. */
  orgId?: string | null;
  name: string;
  slug: string;
  color: string;
  icon: string;
  /** `path` is an organizer-uploaded image in Storage (campaigns/{cid}/cover-*.jpg). Without it the parchment default shows. */
  cover: { src: string; focalX: number; focalY: number; credit?: string; path?: string | null };
  system?: string;
  defaultLocation: string;
  tz: string;
  ownerUid: string;
  /** "oneshot": a standalone one-off game with its own title and invitees. Absent on every regular campaign (and all existing data). */
  kind?: "oneshot";
  status: "active" | "archived";
  allowMemberInvites: boolean;
  /** Off by default: everyone is assumed in until they tap Can't make it. */
  requireRsvps: boolean;
  /** Loot / XP / milestones log. Organizer writes. */
  ledger?: LedgerEntry[];
  /** Fewest players (organizer included) for the night to be on. 0/undefined = not tracked. */
  quorum?: number;
  cadence: Cadence | null;
  /** Legacy field from the snack rotation, which was removed. Ignored. */
  rotation?: { enabled: boolean; order: string[]; nextIndex: number };
  previouslyOn?: string;
  /** Session the Previously on line was taken from. */
  previouslyOnSessionId?: string;
  partyLevel?: number;
  /** Optional cap, used by open tables like Leyfarers. */
  seatLimit?: number | null;
  /** Reserved for a future Discord bot (guild, channel, webhook). */
  discord?: { guildId?: string; channelId?: string; webhookUrl?: string } | null;
  /** Table characters in roster order. Absent when the old docs had none. */
  characters?: TableCharacter[];
  /** Roster order. Matches `characters` when both were migrated. */
  roster?: string[];
  legacy?: Record<string, unknown>;
};

export type AttendanceState = "in" | "out" | "maybe" | "unset";

export type Attendance = {
  uid: string;
  state: AttendanceState;
  note?: string;
  byUid: string;
  updatedAt: string;
};

export type Session = {
  id: string;
  cid: string;
  seriesId?: string | null;
  /** Original local date of the series slot. Stable across a move. */
  occurrenceKey?: string | null;
  /** UTC ISO timestamp. */
  startsAt: string;
  endsAt: string;
  tz: string;
  title: string;
  location: string;
  status: "scheduled" | "cancelled";
  exception?: "skip" | "move" | "cancel" | "edit" | null;
  /** Null inherits the campaign setting. */
  requireRsvps: boolean | null;

  notes?: string;
  /**
   * Read-aloud opener for this night, as markdown. An automation can set it
   * the day of the game. Empty means the Sessions hero falls back to the
   * latest recap's opening paragraph.
   */
  previouslyOn?: string;
  /** ICS SEQUENCE. Bumped whenever the time or status changes. */
  seq: number;
  recapHtml?: string;
  recapText?: string;
  recapMarkdown?: string;
  /** Firebase Storage object path, e.g. recaps/{file} or recaps/{cid}/{sid}/{file}. */
  pdfPath?: string;
  pdfName?: string;
  pdfSize?: number;
  pdfPages?: number;
  /**
   * Display URL for a same-origin sample, or the legacy `/recaps/...` path.
   * Never a Firebase download-token URL. Live preview reads `pdfPath` with the Storage SDK.
   */
  pdfUrl?: string;
  /**
   * Other PDFs in Storage for this night that were not the session's pdfUrl.
   * Bytes stay put. The primary recap remains `pdfPath`.
   */
  extraPdfs?: SessionFile[];
  legacy?: Record<string, unknown>;
  attendance: Attendance[];
  reminder3dSent?: boolean;
  reminder3hSent?: boolean;
};

export type PollOption = {
  id: string;
  startsAt: string;
  /** Absent on a date-only option. New polls store start plus four hours. */
  endsAt?: string;
  tz: string;
};

/** `true` is Works, including every yes saved before Best. `"best"` can attend and is a favorite. */
export type PollPick = boolean | "best";

export type PollVote = {
  picks: Record<string, PollPick>;
  updatedAt: string;
  /** Display name for a ballot cast from the public link. */
  name?: string;
  /**
   * SHA-256 prefix of the device token that may edit this ballot.
   * The raw token stays in the voter's browser.
   */
  guestToken?: string;
};

export type Poll = {
  id: string;
  cid: string;
  title: string;
  options: PollOption[];
  status: "open" | "locked";
  chosenOptionId?: string | null;
  createdBy: string;
  closesAt?: string | null;
  sessionId?: string | null;
  /** uid → when a nudge was requested. A future send (or the Discord bot) reads this. */
  nudges?: Record<string, string>;
  /** Member uid, or `guest:<hash>` for someone who is not on the player list. */
  votes: Record<string, PollVote>;
};

export type Invite = {
  token: string;
  cid: string;
  email?: string | null;
  role: "member" | "coorganizer";
  createdBy: string;
  createdByName: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
  status: "pending" | "accepted" | "revoked";
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  tz: string;
  calToken: string;
  canCreateCampaigns: boolean;
  /** False until the player has chosen a display name. */
  nameSet?: boolean;
};

export type AppState = {
  me: User;
  directory: User[];
  campaigns: Campaign[];
  sessions: Session[];
  members: Record<string, Member[]>;
  polls: Poll[];
  invites: Invite[];
  hiddenCids: string[];
  /** ISO timestamp the group treats as "we started playing". */
  groupStartedOn: string;
  /** True until the first snapshot of every campaign and its sessions has arrived (live mode). */
  syncing?: boolean;
};

export type Toast = { id: number; text: string; tone?: "ok" | "err"; action?: { label: string; run: () => void } };

export type LedgerEntry = { id: string; at: string; kind: "loot" | "xp" | "milestone"; text: string };
