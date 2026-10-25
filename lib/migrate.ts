import { latestRecap } from "./model";
import { omitUndefined } from "./omit";
import { excerpt, legacyRecapFileName, recapPlain, storagePathFromPdfUrl } from "./recap";
import { parseDurationMinutes, parseLegacyTime, zonedTimeToUtc } from "./time";
import { stripHtml } from "./sanitize";
import type { AttendanceState, Campaign, Member, Role, Session, SessionFile, TableCharacter } from "./types";

export type LegacyCampaign = {
  id: string;
  name?: string;
  icon?: string;
  color?: string;
  owner?: string;
  access?: Record<string, string>;
  gameRoles?: Record<string, string>;
  archived?: boolean;
  deleted?: boolean;
  [key: string]: unknown;
};

export type LegacySession = {
  id: string;
  campaign?: string;
  date?: string;
  time?: string;
  duration?: string;
  title?: string;
  location?: string;
  gm?: string;
  status?: string;
  attendance?: Record<string, string>;
  roster?: string[];
  recap?: string;
  recapHtml?: string;
  pdfUrl?: string;
  pdfName?: string;
  [key: string]: unknown;
};

export type LegacyCharacterSheet = {
  charClass?: string;
  subclass?: string;
  level?: string;
  owner?: string;
  imageUrl?: string;
  leyfarer?: boolean;
  [key: string]: unknown;
};

export type RecapFilePlan = {
  /** Firestore id. Matches the single path segment under recaps/. */
  file: string;
  path: string;
  cid: string;
  sessionId: string;
};

export type LegacyShare = { owner?: string; campaign?: string; members?: string[] };

export type StorageObjectPlan = {
  name: string;
  md5Hash?: string;
  contentType?: string;
  size?: string;
};

export type LegacyCode = {
  id: string;
  label?: string;
  owner?: string;
  campaign?: string;
  [key: string]: unknown;
};

export type LegacyExport = {
  campaigns: LegacyCampaign[];
  sessions: LegacySession[];
  shares?: LegacyShare[];
  polls?: Record<string, unknown>[];
  /** cid → character name → sheet. From the characters collection. */
  characters?: Record<string, Record<string, LegacyCharacterSheet>>;
  /** cid → roster order. From the rosters collection. */
  rosters?: Record<string, string[]>;
  codes?: LegacyCode[];
  /** config/characters, including tables that have no campaign document. */
  configCharacters?: Record<string, Record<string, LegacyCharacterSheet>>;
  configRosters?: Record<string, string[]>;
  ivenHeroes?: { id: string; updatedAt?: number; heroesJson?: string }[];
  storage?: StorageObjectPlan[];
  source?: string;
};

export type MigrationWarning = { level: "info" | "warn"; message: string };

export type MemberPlan = Member & { cid: string };

export type CountTrio = { sessions: number; recaps: number; pdfs: number };

export type MigrationPlan = {
  zone: string;
  campaigns: Campaign[];
  sessions: Session[];
  members: MemberPlan[];
  warnings: MigrationWarning[];
  preservedColors: { id: string; color: string; icon: string; name: string }[];
  /** Legacy one-segment PDFs. Bytes stay where they are; this index lets Storage rules check membership. */
  recapFiles: RecapFilePlan[];
  /** Raw export counts, keyed by campaign id. */
  sourceCounts: Record<string, CountTrio>;
  /** Counts this plan would write. */
  plannedCounts: Record<string, CountTrio>;
};

const KNOWN_COLORS: Record<string, string> = {
  frostmaiden: "#4fc3f7",
  strahd: "#ef5350",
  special: "#ce93d8",
  drawsteel: "#f5c518",
  leyfarers: "#4caf50",
  "leyfarers-krenn": "#26a69a",
  beerovia: "#ff9800",
  "ghosts-of-saltmarsh": "#26c6da",
};

const KNOWN_ICONS: Record<string, string> = {
  frostmaiden: "❄️",
  strahd: "🧛",
  special: "✨",
  drawsteel: "🗡️",
  leyfarers: "🧭",
  "leyfarers-krenn": "🧭",
  beerovia: "🍺",
  "ghosts-of-saltmarsh": "🎲",
};

const KNOWN_NAMES: Record<string, string> = {
  frostmaiden: "Rime of the Frostmaiden",
  strahd: "Curse of Strahd",
  special: "One-Shots",
  drawsteel: "Draw Steel: Mini Campaign",
  leyfarers: "Leyfarers",
  "leyfarers-krenn": "Leyfarers: Krenn",
  beerovia: "Beerovia",
  "ghosts-of-saltmarsh": "Ghosts of Saltmarsh",
};

const NEW_CAMPAIGN_KEYS = [
  "orgId", "slug", "cover", "defaultLocation", "tz", "ownerUid", "status",
  "allowMemberInvites", "requireRsvps", "cadence", "rotation", "discord",
  "previouslyOn", "previouslyOnSessionId", "partyLevel", "seatLimit", "system",
  "legacy", "characters", "roster",
];

const SESSION_USED = [
  "id", "campaign", "date", "time", "duration", "title", "location", "status",
  "recap", "recapHtml", "pdfUrl", "pdfName", "attendance",
  "seriesId", "occurrenceKey", "startsAt", "endsAt", "cid", "exception",
  "requireRsvps", "seq", "recapText", "recapMarkdown", "pdfPath", "extraPdfs",
  "legacy", "snackUid", "notes", "reminder3dSent", "reminder3hSent",
];

function emailKey(email: string): string {
  return `email:${email.trim().toLowerCase()}`;
}

function roleFromAccess(value: string | undefined): Role | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === "editor" || v === "coorganizer" || v === "co-organizer") return "coorganizer";
  if (v === "viewer" || v === "member" || v === "player") return "member";
  if (v === "owner" || v === "organizer") return "organizer";
  return "member";
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function text(value: unknown): string | undefined {
  return nonempty(value) ? value.trim() : undefined;
}

function emptyTrio(): CountTrio {
  return { sessions: 0, recaps: 0, pdfs: 0 };
}

function looseStorageName(path: string): string {
  return path.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canon(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function planMigration(input: LegacyExport | Record<string, unknown>, zone = "America/Los_Angeles"): MigrationPlan {
  const legacy = normalizeLegacyExport(input);
  const warnings: MigrationWarning[] = [];
  const memberMap = new Map<string, MemberPlan>();
  const recapFiles: RecapFilePlan[] = [];

  const put = (cid: string, email: string, role: Role, tags: string[] = []) => {
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@")) return;
    const key = `${cid}::${clean}`;
    const prev = memberMap.get(key);
    const rank: Record<Role, number> = { member: 1, coorganizer: 2, organizer: 3 };
    const nextRole = !prev || rank[role] >= rank[prev.role] ? role : prev.role;
    const nextTags = Array.from(new Set([...(prev?.tags ?? []), ...tags]));
    memberMap.set(key, {
      cid,
      id: emailKey(clean),
      email: clean,
      displayName: clean.split("@")[0],
      role: nextRole,
      tags: nextTags,
      joinedAt: new Date(0).toISOString(),
      pending: true,
    });
  };

  const sourceCounts: Record<string, CountTrio> = {};
  for (const raw of legacy.campaigns) sourceCounts[raw.id] = emptyTrio();
  for (const raw of legacy.sessions) {
    const cid = raw.campaign || "(none)";
    sourceCounts[cid] ??= emptyTrio();
    sourceCounts[cid].sessions += 1;
    if (nonempty(raw.recap) || nonempty(raw.recapHtml)) sourceCounts[cid].recaps += 1;
    if (nonempty(raw.pdfUrl)) sourceCounts[cid].pdfs += 1;
  }

  const campaigns: Campaign[] = [];
  for (const raw of legacy.campaigns) {
    if (raw.deleted) {
      warnings.push({ level: "info", message: `Skipped deleted campaign ${raw.id}.` });
      continue;
    }
    const color = (typeof raw.color === "string" && raw.color) || KNOWN_COLORS[raw.id] || "#888888";
    const icon = (typeof raw.icon === "string" && raw.icon) || KNOWN_ICONS[raw.id] || "🎲";
    const name = raw.name || KNOWN_NAMES[raw.id] || raw.id;
    if (raw.owner) put(raw.id, String(raw.owner), "organizer");
    if (raw.access) {
      for (const [email, access] of Object.entries(raw.access)) {
        const role = roleFromAccess(access);
        if (role) put(raw.id, email, role);
      }
    }
    if (raw.gameRoles) {
      for (const [email, gameRole] of Object.entries(raw.gameRoles)) {
        const tags = String(gameRole).toLowerCase() === "gm" ? ["dm"] : [];
        put(raw.id, email, "member", tags);
      }
    }
    const owner = String(raw.owner || "").toLowerCase();
    const table = tableFor(legacy, raw.id, warnings);
    const campaign = omitUndefined({
      id: raw.id,
      orgId: null,
      name,
      slug: raw.id,
      color,
      icon,
      cover: { src: coverFor(raw.id), focalX: 0.5, focalY: 0.45, credit: "Carried from the current site" },
      defaultLocation: "TPK Brewing",
      tz: zone,
      ownerUid: owner ? emailKey(owner) : "",
      status: raw.archived ? "archived" as const : "active" as const,
      allowMemberInvites: true,
      requireRsvps: false,
      cadence: null,
      rotation: { enabled: false, order: [], nextIndex: 0 },
      discord: null,
      characters: table.characters.length ? table.characters : undefined,
      roster: table.roster.length ? table.roster : undefined,
      legacy: leftover(raw, ["id", "name", "icon", "color", "owner", "access", "gameRoles", "archived", "deleted", ...NEW_CAMPAIGN_KEYS]),
    });
    campaigns.push(campaign);
  }

  for (const share of legacy.shares ?? []) {
    const cid = share.campaign;
    if (!cid) continue;
    if (share.owner) put(cid, share.owner, "organizer");
    for (const email of share.members ?? []) put(cid, email, "member");
  }

  flagConfigOnlyTables(legacy, new Set(campaigns.map((c) => c.id)), warnings);
  flagCodes(legacy.codes ?? [], warnings);
  flagIven(legacy.ivenHeroes ?? [], warnings);
  if (legacy.polls?.length) {
    warnings.push({ level: "info", message: `${legacy.polls.length} legacy poll(s) were not imported. The new app has its own polls, and the old documents are left in place.` });
  }

  const knownIds = new Set(campaigns.map((c) => c.id));
  const sessions: Session[] = [];
  const blankTime: string[] = [];
  const tbdTime: string[] = [];
  const blankDuration: string[] = [];
  const dateIdMismatch: string[] = [];
  let unknownAttendance = 0;
  let oddAttendance = 0;
  for (const raw of legacy.sessions) {
    const cid = raw.campaign || "";
    if (!cid || !knownIds.has(cid)) {
      warnings.push({ level: "warn", message: `Session ${raw.id} points at unknown campaign "${cid}". Kept under that id anyway.` });
      if (cid && !knownIds.has(cid)) {
        knownIds.add(cid);
        sourceCounts[cid] ??= emptyTrio();
        campaigns.push(omitUndefined({
          id: cid,
          orgId: null,
          name: KNOWN_NAMES[cid] || cid,
          slug: cid,
          color: KNOWN_COLORS[cid] || "#888888",
          icon: KNOWN_ICONS[cid] || "🎲",
          cover: { src: coverFor(cid), focalX: 0.5, focalY: 0.45 },
          defaultLocation: "",
          tz: zone,
          ownerUid: "",
          status: "active" as const,
          allowMemberInvites: true,
          requireRsvps: false,
          cadence: null,
          rotation: { enabled: false, order: [], nextIndex: 0 },
        }));
      }
    }
    const hm = parseLegacyTime(raw.time);
    if (!raw.date) {
      warnings.push({ level: "warn", message: `Session ${raw.id} has no date and was skipped.` });
      continue;
    }
    if (!hm) {
      if (nonempty(raw.time) && /^tbd$/i.test(raw.time.trim())) tbdTime.push(`${raw.id} (${raw.date})`);
      else blankTime.push(raw.id);
    }
    if (!nonempty(raw.duration)) blankDuration.push(raw.id);
    const idDate = /^(\d{4}-\d{2}-\d{2})/.exec(raw.id)?.[1];
    if (idDate && idDate !== raw.date) dateIdMismatch.push(`${raw.id} plays on ${raw.date}`);
    const start = zonedTimeToUtc(raw.date, hm || "18:00", zone);
    const minutes = parseDurationMinutes(raw.duration, 240);
    const end = new Date(start.getTime() + minutes * 60_000);
    const cancelled = typeof raw.status === "string" && /cancel/i.test(raw.status);
    const attendance = Object.entries(raw.attendance ?? {}).flatMap(([name, value]) => {
      const state: AttendanceState | null = value === "in" || value === "out" || value === "maybe" || value === "unset"
        ? value
        : value === "unknown" ? "unset" : null;
      if (value === "unknown") unknownAttendance += 1;
      if (!state) {
        oddAttendance += 1;
        return [];
      }
      return [{
        uid: `name:${name}`,
        state,
        byUid: "migration",
        updatedAt: new Date(0).toISOString(),
        note: value === "unknown"
          ? "Legacy attendance was unknown, stored by character name. The app treats unset as assumed in."
          : "Legacy attendance was stored by character name, not account.",
      }];
    });
    const recapText = text(raw.recap) || (nonempty(raw.recapHtml) ? stripHtml(String(raw.recapHtml)) : "");
    const sessionId = `legacy-${raw.id}`;
    const pdfUrl = text(raw.pdfUrl);
    const pdfName = text(raw.pdfName);
    const located = storagePathFromPdfUrl(pdfUrl);
    let pdfPath: string | undefined;
    let keptUrl: string | undefined;
    if (located.avatar) {
      warnings.push({ level: "info", message: `Session ${raw.id} points at a portrait under recaps/avatars. That is not a recap PDF and was left alone.` });
    } else if (located.path) {
      pdfPath = located.path;
      rememberRecapFile(recapFiles, warnings, located.path, cid, sessionId);
      if (located.tokenStripped) {
        warnings.push({ level: "info", message: `Session ${raw.id} had a Firebase download token in pdfUrl. The Storage path is kept and the token URL is dropped so it cannot bypass member checks.` });
      } else if (pdfUrl && pdfUrl.startsWith("/recaps/")) {
        keptUrl = pdfUrl.split("?")[0];
      }
    } else if (pdfUrl) {
      warnings.push({ level: "warn", message: `Session ${raw.id} pdfUrl is not a Storage recap path. It is kept on the session, and member-only rules cannot cover it.` });
      keptUrl = pdfUrl;
    }
    sessions.push(omitUndefined({
      id: sessionId,
      cid,
      seriesId: null,
      occurrenceKey: raw.date,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      tz: zone,
      title: text(raw.title) || KNOWN_NAMES[cid] || cid,
      location: text(raw.location) || "TPK Brewing",
      status: cancelled ? "cancelled" as const : "scheduled" as const,
      exception: null,
      requireRsvps: null,
      seq: 0,
      recapHtml: nonempty(raw.recapHtml) ? raw.recapHtml : undefined,
      recapText: recapText || undefined,
      pdfPath,
      pdfName,
      pdfUrl: keptUrl,
      attendance,
      legacy: leftover(raw, SESSION_USED),
    }));
  }

  if (blankTime.length) {
    warnings.push({ level: "info", message: `${blankTime.length} session${blankTime.length === 1 ? "" : "s"} ha${blankTime.length === 1 ? "s" : "ve"} no time. Assumed 6:00 PM ${zone}.` });
  }
  if (tbdTime.length) {
    warnings.push({ level: "info", message: `${tbdTime.length} session${tbdTime.length === 1 ? "" : "s"} ${tbdTime.length === 1 ? "is" : "are"} marked TBD. Assumed 6:00 PM ${zone}: ${tbdTime.join(", ")}.` });
  }
  if (blankDuration.length) {
    warnings.push({ level: "info", message: `${blankDuration.length} session${blankDuration.length === 1 ? "" : "s"} ha${blankDuration.length === 1 ? "s" : "ve"} no duration. Assumed 4 hours.` });
  }
  if (unknownAttendance) {
    warnings.push({ level: "info", message: `${unknownAttendance} attendance value${unknownAttendance === 1 ? "" : "s"} ${unknownAttendance === 1 ? "was" : "were"} "unknown". Stored as unset, which the app treats as assumed in. The character name is kept on the attendance row.` });
  }
  if (oddAttendance) {
    warnings.push({ level: "warn", message: `${oddAttendance} attendance values were neither in, out, maybe, nor unknown, and were left only on the original session document.` });
  }
  if (dateIdMismatch.length) {
    warnings.push({ level: "info", message: `Session document ids are kept (legacy-{id}) even when the id's date is not the play date, so a re-run merges instead of duplicating: ${dateIdMismatch.join("; ")}.` });
  }

  const withOwner = campaigns.filter((c) => c.ownerUid).length;
  if (campaigns.length && withOwner < campaigns.length) {
    warnings.push({ level: "warn", message: `${campaigns.length - withOwner} campaign(s) have no owner email. They need an Organizer before anyone can manage them.` });
  }
  warnings.push({
    level: "info",
    message: "Cadence is not invented from old dates. Each existing session is kept as its own play date. Seth can turn on a series afterwards; a date that already exists is attached, not duplicated.",
  });
  warnings.push({
    level: "info",
    message: "Accounts are linked by email on first magic-link sign-in. Until then members are pending email keys, so nobody is given a password. Character names and GM names are not turned into accounts.",
  });
  warnings.push({
    level: "info",
    message: "Recap PDFs stay at their current Storage paths. This plan does not copy or delete bytes. Legacy recaps/{file} objects are authorized for campaign members through recapFiles/{file}. New uploads use recaps/{campaign}/{session}/{file}.",
  });
  warnings.push({
    level: "info",
    message: "Ids are stable: campaign ids are unchanged, members are email:{address}, sessions are legacy-{firestore id}. Apply merges, so the partial run (campaign fields, one organizer member per campaign, and the two Strahd sessions that already have PDFs) is updated in place.",
  });
  warnings.push({
    level: "info",
    message: "Fields with no new-model column stay on campaign.legacy or session.legacy: bridge, chapter, leyfarer, createdAt, readers, gm, roster, type, level, completed, invited, owner. Old collections are not deleted. status active or missing becomes scheduled; cancelled stays cancelled.",
  });

  const portraits = new Set<string>();
  for (const campaign of campaigns) {
    for (const character of campaign.characters ?? []) {
      if (character.imagePath) portraits.add(character.imagePath);
    }
  }
  attachStorage(legacy.storage ?? [], sessions, recapFiles, warnings, portraits);
  const sheetOwners = campaigns.flatMap((campaign) =>
    (campaign.characters ?? []).filter((character) => character.ownerEmail).map((character) => `${character.name} ${character.ownerEmail}`),
  );
  if (sheetOwners.length) {
    warnings.push({ level: "info", message: `Character sheet owner emails stay on the character and are not extra members: ${sheetOwners.join(", ")}.` });
  }

  for (const campaign of campaigns) {
    if (campaign.previouslyOn) continue;
    const latest = latestRecap(sessions, campaign.id);
    if (!latest) continue;
    const plain = recapPlain(latest);
    const line = plain ? excerpt(plain) : latest.pdfName ? `PDF: ${latest.pdfName}` : "";
    if (!line) continue;
    campaign.previouslyOn = line;
    campaign.previouslyOnSessionId = latest.id;
  }

  const plannedCounts: Record<string, CountTrio> = {};
  for (const campaign of campaigns) plannedCounts[campaign.id] = emptyTrio();
  for (const session of sessions) {
    plannedCounts[session.cid] ??= emptyTrio();
    plannedCounts[session.cid].sessions += 1;
    if (session.recapText || session.recapHtml) plannedCounts[session.cid].recaps += 1;
    if (session.pdfPath) plannedCounts[session.cid].pdfs += 1;
  }

  return {
    zone,
    campaigns,
    sessions,
    members: [...memberMap.values()],
    warnings,
    preservedColors: campaigns.map((c) => ({ id: c.id, color: c.color, icon: c.icon, name: c.name })),
    recapFiles,
    sourceCounts,
    plannedCounts,
  };
}

export function formatDryRun(plan: MigrationPlan, source: string): string {
  const lines: string[] = [];
  lines.push("Taverning — migration dry run");
  lines.push("No writes. Nothing was sent to Firestore.");
  lines.push(`Source: ${source}`);
  lines.push(`Time zone applied to legacy date+time strings: ${plan.zone}`);
  lines.push("");
  lines.push(`Campaigns: ${plan.campaigns.length}`);
  for (const c of plan.campaigns) {
    const members = plan.members.filter((m) => m.cid === c.id);
    const org = members.find((m) => m.role === "organizer");
    const sessions = plan.sessions.filter((s) => s.cid === c.id);
    const characterCount = c.characters?.length ?? 0;
    lines.push(
      `  ${c.id}  ${c.icon}  ${c.name}  color=${c.color}  status=${c.status}  organizer=${org?.email ?? "—"}  members=${members.length}  sessions=${sessions.length}  characters=${characterCount}`,
    );
    const legacyBits = legacySummary(c.legacy);
    if (legacyBits) lines.push(`    legacy: ${legacyBits}`);
    const dms = members.filter((m) => m.tags.includes("dm")).map((m) => m.email);
    if (dms.length) lines.push(`    dm tag (no permissions): ${dms.join(", ")}`);
    for (const m of members) lines.push(`    ${m.role.padEnd(12)} ${m.email}`);
    if (c.characters?.length) {
      for (const character of c.characters) {
        const bits = [character.charClass, character.subclass, character.level ? `level ${character.level}` : "", character.leyfarer ? "leyfarer" : ""].filter(Boolean);
        const portrait = character.imagePath ? `  portrait=${character.imagePath}` : "";
        lines.push(`    roster  ${character.name}${bits.length ? `  ${bits.join(" · ")}` : ""}${portrait}`);
      }
    }
  }
  lines.push("");
  lines.push("Source vs plan (sessions / recaps / pdfs). Handouts are extra Storage PDFs and are not part of the pdf count:");
  const ids = [...new Set([...Object.keys(plan.sourceCounts), ...Object.keys(plan.plannedCounts)])].sort();
  const totalSource = emptyTrio();
  const totalPlanned = emptyTrio();
  for (const id of ids) {
    const src = plan.sourceCounts[id] ?? emptyTrio();
    const planned = plan.plannedCounts[id] ?? emptyTrio();
    totalSource.sessions += src.sessions;
    totalSource.recaps += src.recaps;
    totalSource.pdfs += src.pdfs;
    totalPlanned.sessions += planned.sessions;
    totalPlanned.recaps += planned.recaps;
    totalPlanned.pdfs += planned.pdfs;
    const handouts = plan.sessions.filter((s) => s.cid === id).reduce((sum, s) => sum + (s.extraPdfs?.length ?? 0), 0);
    const mark = src.sessions === planned.sessions && src.recaps === planned.recaps && src.pdfs === planned.pdfs ? "ok" : "MISMATCH";
    lines.push(`  ${id.padEnd(22)} sessions ${src.sessions}/${planned.sessions}  recaps ${src.recaps}/${planned.recaps}  pdfs ${src.pdfs}/${planned.pdfs}${handouts ? `  handouts ${handouts}` : ""}  ${mark}`);
  }
  const totalMark = totalSource.sessions === totalPlanned.sessions && totalSource.recaps === totalPlanned.recaps && totalSource.pdfs === totalPlanned.pdfs ? "ok" : "MISMATCH";
  lines.push(`  ${"TOTAL".padEnd(22)} sessions ${totalSource.sessions}/${totalPlanned.sessions}  recaps ${totalSource.recaps}/${totalPlanned.recaps}  pdfs ${totalSource.pdfs}/${totalPlanned.pdfs}  ${totalMark}`);
  lines.push("");
  lines.push(`Sessions: ${plan.sessions.length}`);
  const sample = plan.sessions.slice(0, 8);
  for (const s of sample) {
    lines.push(`  ${s.occurrenceKey} ${s.title} → ${s.startsAt} (${s.tz}) status=${s.status}`);
  }
  if (plan.sessions.length > sample.length) lines.push(`  … ${plan.sessions.length - sample.length} more`);
  const withRecap = plan.sessions.filter((s) => s.recapHtml || s.recapText).length;
  const withPdf = plan.sessions.filter((s) => s.pdfPath).length;
  lines.push(`Recaps carried: ${withRecap} (text or HTML, unchanged)`);
  lines.push(`PDFs carried: ${withPdf} (Storage path unchanged; bytes are not copied)`);
  for (const file of plan.recapFiles) {
    lines.push(`  ${file.path} → ${file.cid} (${file.sessionId})`);
  }
  lines.push("");
  lines.push("Colors (unchanged):");
  for (const c of plan.preservedColors) lines.push(`  ${c.id} ${c.color} ${c.icon} ${c.name}`);
  lines.push("");
  lines.push("Notes:");
  for (const w of plan.warnings) lines.push(`  [${w.level}] ${w.message}`);
  return lines.join("\n") + "\n";
}

function legacySummary(legacy: Record<string, unknown> | undefined): string {
  if (!legacy) return "";
  return Object.entries(legacy).map(([key, value]) => {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return `${key}=${value}`;
    if (Array.isArray(value)) return `${key}[${value.length}]`;
    return key;
  }).join(", ");
}

function tableFor(legacy: LegacyExport, cid: string, warnings: MigrationWarning[]): { characters: TableCharacter[]; roster: string[] } {
  const sheets: Record<string, LegacyCharacterSheet> = { ...(legacy.characters?.[cid] ?? {}) };
  const configSheets = legacy.configCharacters?.[cid];
  if (configSheets) {
    if (canon(configSheets) !== canon(sheets) && Object.keys(sheets).length && Object.keys(configSheets).length) {
      warnings.push({ level: "warn", message: `config/characters/${cid} differs from characters/${cid}. The characters collection is what gets written.` });
    }
    for (const [name, sheet] of Object.entries(configSheets)) {
      if (!sheets[name]) {
        sheets[name] = sheet;
        warnings.push({ level: "info", message: `${cid} character ${name} exists only in config/characters and was included.` });
      }
    }
  }
  let roster = [...(legacy.rosters?.[cid] ?? [])];
  const configRoster = legacy.configRosters?.[cid];
  if (configRoster && canon(configRoster) !== canon(roster)) {
    if (!roster.length && configRoster.length) {
      roster = [...configRoster];
      warnings.push({ level: "info", message: `${cid} roster was taken from config/rosters because rosters/${cid} is missing or empty.` });
    } else if (roster.length) {
      warnings.push({ level: "warn", message: `config/rosters/${cid} differs from rosters/${cid}. The rosters collection order is kept.` });
    }
  }
  for (const name of Object.keys(sheets)) {
    if (!roster.includes(name)) roster.push(name);
  }
  const hasCollection = legacy.characters?.[cid] !== undefined || legacy.rosters?.[cid] !== undefined;
  if (!hasCollection && !configSheets && !configRoster) {
    warnings.push({ level: "info", message: `${cid} has no characters or rosters document.` });
  }
  const characters = roster.map((name) => toTableCharacter(name, sheets[name], warnings));
  return { characters, roster };
}

function toTableCharacter(name: string, sheet: LegacyCharacterSheet | undefined, warnings: MigrationWarning[]): TableCharacter {
  if (!sheet) {
    warnings.push({ level: "warn", message: `${name} is on a roster without a character sheet. The name is kept.` });
    return { name };
  }
  const character: TableCharacter = { name };
  const charClass = text(sheet.charClass);
  const subclass = text(sheet.subclass);
  const level = text(sheet.level);
  if (charClass) character.charClass = charClass;
  if (subclass) character.subclass = subclass;
  if (level) character.level = level;
  if (sheet.leyfarer === true) character.leyfarer = true;
  if (nonempty(sheet.owner) && sheet.owner.includes("@")) character.ownerEmail = sheet.owner.trim().toLowerCase();
  if (nonempty(sheet.imageUrl)) {
    const located = storagePathFromPdfUrl(sheet.imageUrl);
    if (located.path) {
      character.imagePath = located.path;
      if (located.tokenStripped) {
        warnings.push({ level: "info", message: `Character ${name} imageUrl had a download token. Kept the Storage path ${located.path} and dropped the token.` });
      }
    } else {
      warnings.push({ level: "warn", message: `Character ${name} imageUrl is not a Storage path. It was not copied onto the character.` });
    }
  }
  const known = new Set(["charClass", "subclass", "level", "owner", "imageUrl", "leyfarer"]);
  for (const key of Object.keys(sheet)) {
    if (!known.has(key)) {
      warnings.push({ level: "warn", message: `Character ${name} field "${key}" has no column on the new character. It stays on the original characters document.` });
    }
  }
  return character;
}

function flagConfigOnlyTables(legacy: LegacyExport, campaignIds: Set<string>, warnings: MigrationWarning[]) {
  const ids = new Set([...Object.keys(legacy.configCharacters ?? {}), ...Object.keys(legacy.configRosters ?? {})]);
  for (const cid of ids) {
    if (campaignIds.has(cid)) continue;
    const sheets = Object.keys(legacy.configCharacters?.[cid] ?? {});
    const roster = legacy.configRosters?.[cid] ?? [];
    warnings.push({
      level: "warn",
      message: `config has a roster for "${cid}" but there is no campaigns/${cid} document, so it was not turned into a campaign. Left in config/characters and config/rosters. Roster: ${roster.join(", ") || "—"}. Sheets: ${sheets.join(", ") || "—"}.`,
    });
  }
}

function flagCodes(codes: LegacyCode[], warnings: MigrationWarning[]) {
  if (!codes.length) return;
  const listed = codes.map((code) => `codes/${code.id}${code.label ? ` (${code.label})` : ""} → ${code.campaign || "?"}`).join("; ");
  warnings.push({
    level: "warn",
    message: `${codes.length} old share code${codes.length === 1 ? "" : "s"} ${codes.length === 1 ? "is" : "are"} not invites in the new app. They stay in the codes collection and are not deleted: ${listed}.`,
  });
}

function flagIven(heroes: { id: string; updatedAt?: number; heroesJson?: string }[], warnings: MigrationWarning[]) {
  for (const doc of heroes) {
    const bytes = doc.heroesJson?.length ?? 0;
    warnings.push({
      level: "warn",
      message: `ivenHeroes/${doc.id} is the separate Iven app (heroesJson ${bytes} chars${doc.updatedAt ? `, updatedAt ${doc.updatedAt}` : ""}). It is not copied onto a session. The collection is left in place.`,
    });
  }
}

function rememberRecapFile(recapFiles: RecapFilePlan[], warnings: MigrationWarning[], path: string, cid: string, sessionId: string) {
  const file = legacyRecapFileName(path);
  if (!file) return;
  if (recapFiles.some((entry) => entry.file === file)) {
    warnings.push({ level: "warn", message: `Two sessions share recaps/${file}. The first campaign keeps the member check.` });
    return;
  }
  recapFiles.push({ file, path, cid, sessionId });
}

function attachStorage(
  objects: StorageObjectPlan[],
  sessions: Session[],
  recapFiles: RecapFilePlan[],
  warnings: MigrationWarning[],
  portraits: Set<string>,
) {
  if (!objects.length) return;
  const linkedLoose = new Map<string, string>();
  const linkedMd5 = new Map<string, string>();
  for (const session of sessions) {
    if (!session.pdfPath) continue;
    linkedLoose.set(looseStorageName(session.pdfPath), session.pdfPath);
  }
  for (const object of objects) {
    const linked = linkedLoose.get(looseStorageName(object.name));
    if (linked && object.md5Hash) linkedMd5.set(linked, object.md5Hash);
  }
  const portraitPaths = new Set<string>();
  for (const object of objects) {
    if (!object.name.startsWith("recaps/")) {
      warnings.push({ level: "warn", message: `Storage object ${object.name} is outside recaps/ and was not attached.` });
      continue;
    }
    if (object.name.startsWith("recaps/avatars/")) {
      portraitPaths.add(object.name);
      continue;
    }
    const loose = looseStorageName(object.name);
    const linked = linkedLoose.get(loose);
    if (linked) {
      if (linked !== object.name) {
        const sameBytes = object.md5Hash && linkedMd5.get(linked) === object.md5Hash;
        warnings.push({ level: "info", message: `${object.name} is the same recap as ${linked}${sameBytes ? " (same md5)" : ""}, with different spaces or punctuation. It is not attached a second time. Bytes stay in Storage.` });
      }
      continue;
    }
    const date = /^recaps\/(\d{4}-\d{2}-\d{2})(?:_|\s)/.exec(object.name)?.[1];
    const matches = date ? sessions.filter((session) => session.occurrenceKey === date) : [];
    if (matches.length === 1) {
      const session = matches[0]!;
      const file: SessionFile = { path: object.name, name: object.name.split("/").pop() || object.name };
      session.extraPdfs = [...(session.extraPdfs ?? []), file];
      rememberRecapFile(recapFiles, warnings, object.name, session.cid, session.id);
      warnings.push({ level: "info", message: `${object.name} is in Storage but was not the session pdfUrl. Attached as an extra PDF on ${session.id} (${session.cid}, ${session.occurrenceKey}).` });
      continue;
    }
    const why = !date
      ? "the file name has no date"
      : matches.length === 0
        ? `no session is dated ${date}`
        : `${matches.length} sessions are dated ${date}, so it was not guessed`;
    warnings.push({ level: "warn", message: `${object.name} was not attached to a session (${why}). It stays in Storage and is not indexed in recapFiles, so the new member rule will not serve it until it is attached.` });
  }
  for (const path of portraitPaths) {
    if (!portraits.has(path)) {
      warnings.push({ level: "warn", message: `${path} is a portrait in Storage and no character imageUrl points at it.` });
    }
  }
  if (objects.length) {
    for (const path of portraits) {
      if (![...portraitPaths].includes(path) && !objects.some((object) => object.name === path)) {
        warnings.push({ level: "warn", message: `Character portrait ${path} is not in the Storage manifest.` });
      }
    }
  }
}

function coverFor(id: string): string {
  const map: Record<string, string> = {
    strahd: "/covers/abbey.svg",
    frostmaiden: "/covers/frost.svg",
    drawsteel: "/covers/storm.svg",
    leyfarers: "/covers/wilds.svg",
    "leyfarers-krenn": "/covers/wilds.svg",
    beerovia: "/covers/tavern.svg",
    special: "/covers/arcane.svg",
    "ghosts-of-saltmarsh": "/covers/tavern.svg",
  };
  return map[id] || "/covers/tavern.svg";
}

function leftover(raw: Record<string, unknown>, used: string[]): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (used.includes(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Accept the built-in fixture shape or a Firestore REST export keyed by collection/id. */
export function normalizeLegacyExport(raw: unknown): LegacyExport {
  if (isPlainExport(raw)) return raw;
  if (isRestMap(raw)) return restToExport(raw);
  throw new Error("Unrecognized legacy export. Expected { campaigns, sessions } or a Firestore REST map keyed by collection/id.");
}

function isPlainExport(raw: unknown): raw is LegacyExport {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const value = raw as LegacyExport;
  return Array.isArray(value.campaigns) && Array.isArray(value.sessions);
}

function isRestMap(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return Object.keys(raw).some((key) => key.startsWith("campaigns/") || key.startsWith("sessions/"));
}

function restToExport(raw: Record<string, unknown>): LegacyExport {
  const campaigns: LegacyCampaign[] = [];
  const sessions: LegacySession[] = [];
  const characters: Record<string, Record<string, LegacyCharacterSheet>> = {};
  const rosters: Record<string, string[]> = {};
  const codes: LegacyCode[] = [];
  let configCharacters: Record<string, Record<string, LegacyCharacterSheet>> | undefined;
  let configRosters: Record<string, string[]> | undefined;
  const ivenHeroes: { id: string; updatedAt?: number; heroesJson?: string }[] = [];

  for (const [key, value] of Object.entries(raw)) {
    const slash = key.indexOf("/");
    if (slash < 0) continue;
    const collection = key.slice(0, slash);
    const id = key.slice(slash + 1);
    const doc = unwrapFirestoreValue(value);
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) continue;
    const fields = doc as Record<string, unknown>;
    if (collection === "campaigns") campaigns.push({ ...fields, id });
    else if (collection === "sessions") sessions.push({ ...fields, id } as LegacySession);
    else if (collection === "characters") {
      const chars = fields.chars;
      characters[id] = chars && typeof chars === "object" && !Array.isArray(chars) ? chars as Record<string, LegacyCharacterSheet> : {};
    } else if (collection === "rosters") {
      rosters[id] = Array.isArray(fields.list) ? fields.list.filter((item): item is string => typeof item === "string") : [];
    } else if (collection === "codes") codes.push({ ...fields, id });
    else if (collection === "config" && id === "characters") {
      configCharacters = fields as Record<string, Record<string, LegacyCharacterSheet>>;
    } else if (collection === "config" && id === "rosters") {
      configRosters = Object.fromEntries(Object.entries(fields).map(([cid, list]) => [
        cid,
        Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [],
      ]));
    } else if (collection === "ivenHeroes") {
      ivenHeroes.push({
        id,
        updatedAt: typeof fields.updatedAt === "number" ? fields.updatedAt : undefined,
        heroesJson: typeof fields.heroesJson === "string" ? fields.heroesJson : undefined,
      });
    }
  }

  return omitUndefined({
    campaigns,
    sessions,
    characters,
    rosters,
    codes,
    configCharacters,
    configRosters,
    ivenHeroes,
  });
}

export function unwrapFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const typed = value as Record<string, unknown>;
  if ("stringValue" in typed) return typed.stringValue;
  if ("integerValue" in typed) return Number(typed.integerValue);
  if ("doubleValue" in typed) return Number(typed.doubleValue);
  if ("booleanValue" in typed) return typed.booleanValue;
  if ("nullValue" in typed) return null;
  if ("timestampValue" in typed) return typed.timestampValue;
  if ("arrayValue" in typed) {
    const values = (typed.arrayValue as { values?: unknown[] } | undefined)?.values ?? [];
    return values.map(unwrapFirestoreValue);
  }
  if ("mapValue" in typed) {
    const fields = (typed.mapValue as { fields?: Record<string, unknown> } | undefined)?.fields ?? {};
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(fields)) out[key] = unwrapFirestoreValue(item);
    return out;
  }
  if ("fields" in typed && typed.fields && typeof typed.fields === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(typed.fields as Record<string, unknown>)) out[key] = unwrapFirestoreValue(item);
    return out;
  }
  return value;
}
