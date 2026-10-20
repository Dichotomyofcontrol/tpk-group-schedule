import { latestRecap } from "./model";
import { excerpt, legacyRecapFileName, recapPlain, storagePathFromPdfUrl } from "./recap";
import { parseDurationMinutes, parseLegacyTime, zonedTimeToUtc } from "./time";
import { stripHtml } from "./sanitize";
import type { Campaign, Member, Role, Session } from "./types";

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

export type RecapFilePlan = {
  /** Firestore id. Matches the single path segment under recaps/. */
  file: string;
  path: string;
  cid: string;
  sessionId: string;
};

export type LegacyShare = { owner?: string; campaign?: string; members?: string[] };

export type LegacyExport = {
  campaigns: LegacyCampaign[];
  sessions: LegacySession[];
  shares?: LegacyShare[];
  polls?: Record<string, unknown>[];
  characters?: Record<string, unknown>;
  source?: string;
};

export type MigrationWarning = { level: "info" | "warn"; message: string };

export type MemberPlan = Member & { cid: string };

export type MigrationPlan = {
  zone: string;
  campaigns: Campaign[];
  sessions: Session[];
  members: MemberPlan[];
  warnings: MigrationWarning[];
  preservedColors: { id: string; color: string; icon: string; name: string }[];
  /** Legacy one-segment PDFs. Bytes stay where they are; this index lets Storage rules check membership. */
  recapFiles: RecapFilePlan[];
};

const KNOWN_COLORS: Record<string, string> = {
  frostmaiden: "#4fc3f7",
  strahd: "#ef5350",
  special: "#ce93d8",
  drawsteel: "#f5c518",
  leyfarers: "#4caf50",
  beerovia: "#ff9800",
};

const KNOWN_ICONS: Record<string, string> = {
  frostmaiden: "❄️",
  strahd: "🧛",
  special: "✨",
  drawsteel: "🗡️",
  leyfarers: "🧭",
  beerovia: "🍺",
};

const KNOWN_NAMES: Record<string, string> = {
  frostmaiden: "Rime of the Frostmaiden",
  strahd: "Curse of Strahd",
  special: "One-Shots",
  drawsteel: "Draw Steel: Mini Campaign",
  leyfarers: "Leyfarers",
  beerovia: "Beerovia",
};

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

export function planMigration(legacy: LegacyExport, zone = "America/Los_Angeles"): MigrationPlan {
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
    campaigns.push({
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
      status: raw.archived ? "archived" : "active",
      allowMemberInvites: true,
      requireRsvps: false,
      cadence: null,
      rotation: { enabled: false, order: [], nextIndex: 0 },
      discord: null,
      legacy: leftover(raw, ["id", "name", "icon", "color", "owner", "access", "gameRoles", "archived", "deleted"]),
    });
  }

  for (const share of legacy.shares ?? []) {
    const cid = share.campaign;
    if (!cid) continue;
    if (share.owner) put(cid, share.owner, "organizer");
    for (const email of share.members ?? []) put(cid, email, "member");
  }

  const knownIds = new Set(campaigns.map((c) => c.id));
  const sessions: Session[] = [];
  for (const raw of legacy.sessions) {
    const cid = raw.campaign || "";
    if (!cid || !knownIds.has(cid)) {
      warnings.push({ level: "warn", message: `Session ${raw.id} points at unknown campaign "${cid}". Kept under that id anyway.` });
      if (cid && !knownIds.has(cid)) {
        knownIds.add(cid);
        campaigns.push({
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
          status: "active",
          allowMemberInvites: true,
          requireRsvps: false,
          cadence: null,
          rotation: { enabled: false, order: [], nextIndex: 0 },
        });
      }
    }
    const hm = parseLegacyTime(raw.time);
    if (!raw.date) {
      warnings.push({ level: "warn", message: `Session ${raw.id} has no date and was skipped.` });
      continue;
    }
    if (!hm) warnings.push({ level: "info", message: `Session ${raw.id} time "${raw.time ?? ""}" — assumed 6:00 PM ${zone}.` });
    const start = zonedTimeToUtc(raw.date, hm || "18:00", zone);
    const minutes = parseDurationMinutes(raw.duration, 240);
    const end = new Date(start.getTime() + minutes * 60_000);
    const cancelled = typeof raw.status === "string" && /cancel/i.test(raw.status);
    const attendance = Object.entries(raw.attendance ?? {})
      .filter(([, value]) => value === "out" || value === "in" || value === "maybe")
      .map(([name, value]) => ({
        uid: `name:${name}`,
        state: value as "in" | "out" | "maybe",
        byUid: "migration",
        updatedAt: new Date(0).toISOString(),
        note: "Legacy attendance was stored by character name, not account.",
      }));
    const recapText = raw.recap || (raw.recapHtml ? stripHtml(String(raw.recapHtml)) : "");
    const sessionId = `legacy-${raw.id}`;
    const pdfUrl = typeof raw.pdfUrl === "string" ? raw.pdfUrl : undefined;
    const pdfName = typeof raw.pdfName === "string" ? raw.pdfName : undefined;
    const located = storagePathFromPdfUrl(pdfUrl);
    let pdfPath: string | undefined;
    let keptUrl: string | undefined;
    if (located.avatar) {
      warnings.push({ level: "info", message: `Session ${raw.id} points at a portrait under recaps/avatars. That is not a recap PDF and was left alone.` });
    } else if (located.path) {
      pdfPath = located.path;
      const file = legacyRecapFileName(located.path);
      if (file) {
        if (recapFiles.some((entry) => entry.file === file)) {
          warnings.push({ level: "warn", message: `Two sessions share recaps/${file}. The first campaign keeps the member check.` });
        } else {
          recapFiles.push({ file, path: located.path, cid, sessionId });
        }
      }
      if (located.tokenStripped) {
        warnings.push({ level: "info", message: `Session ${raw.id} had a Firebase download token in pdfUrl. The Storage path is kept and the token URL is dropped so it cannot bypass member checks.` });
      } else if (pdfUrl && pdfUrl.startsWith("/recaps/")) {
        keptUrl = pdfUrl.split("?")[0];
      }
    } else if (pdfUrl) {
      warnings.push({ level: "warn", message: `Session ${raw.id} pdfUrl is not a Storage recap path. It is kept on the session, and member-only rules cannot cover it.` });
      keptUrl = pdfUrl;
    }
    sessions.push({
      id: sessionId,
      cid,
      seriesId: null,
      occurrenceKey: raw.date,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      tz: zone,
      title: raw.title || KNOWN_NAMES[cid] || cid,
      location: raw.location || "TPK Brewing",
      status: cancelled ? "cancelled" : "scheduled",
      exception: null,
      requireRsvps: null,
      seq: 0,
      recapHtml: raw.recapHtml,
      recapText: recapText || undefined,
      pdfPath,
      pdfName,
      pdfUrl: keptUrl,
      attendance,
      legacy: leftover(raw, ["id", "campaign", "date", "time", "duration", "title", "location", "status", "recap", "recapHtml", "pdfUrl", "pdfName"]),
    });
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
    message: "Accounts are linked by email on first magic-link sign-in. Until then members are pending email keys, so nobody is given a password.",
  });
  warnings.push({
    level: "info",
    message: "Recap PDFs stay at their current Storage paths. This plan does not copy or delete bytes. Legacy recaps/{file} objects are authorized for campaign members through recapFiles/{file}. New uploads use recaps/{campaign}/{session}/{file}.",
  });
  for (const campaign of campaigns) {
    if (campaign.previouslyOn) continue;
    const latest = latestRecap(sessions, campaign.id);
    if (!latest) continue;
    const text = recapPlain(latest);
    const line = text ? excerpt(text) : latest.pdfName ? `PDF: ${latest.pdfName}` : "";
    if (!line) continue;
    campaign.previouslyOn = line;
    campaign.previouslyOnSessionId = latest.id;
  }

  return {
    zone,
    campaigns,
    sessions,
    members: [...memberMap.values()],
    warnings,
    preservedColors: campaigns.map((c) => ({ id: c.id, color: c.color, icon: c.icon, name: c.name })),
    recapFiles,
  };
}

export function formatDryRun(plan: MigrationPlan, source: string): string {
  const lines: string[] = [];
  lines.push("Six in the TPK — migration dry run");
  lines.push("No writes. Nothing was sent to Firestore.");
  lines.push(`Source: ${source}`);
  lines.push(`Time zone applied to legacy date+time strings: ${plan.zone}`);
  lines.push("");
  lines.push(`Campaigns: ${plan.campaigns.length}`);
  for (const c of plan.campaigns) {
    const members = plan.members.filter((m) => m.cid === c.id);
    const org = members.find((m) => m.role === "organizer");
    const sessions = plan.sessions.filter((s) => s.cid === c.id);
    lines.push(
      `  ${c.id}  ${c.icon}  ${c.name}  color=${c.color}  status=${c.status}  organizer=${org?.email ?? "—"}  members=${members.length}  sessions=${sessions.length}`,
    );
    const dms = members.filter((m) => m.tags.includes("dm")).map((m) => m.email);
    if (dms.length) lines.push(`    dm tag (no permissions): ${dms.join(", ")}`);
    for (const m of members) lines.push(`    ${m.role.padEnd(12)} ${m.email}`);
  }
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

function coverFor(id: string): string {
  const map: Record<string, string> = {
    strahd: "/covers/abbey.svg",
    frostmaiden: "/covers/frost.svg",
    drawsteel: "/covers/storm.svg",
    leyfarers: "/covers/wilds.svg",
    beerovia: "/covers/tavern.svg",
    special: "/covers/arcane.svg",
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
