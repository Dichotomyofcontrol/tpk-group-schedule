import { rememberCharacter } from "./character-summary";
import { excerpt, recapPlain, type RecapPatch } from "./recap";
import { cadenceDates, horizonEnd, occurrenceInstant } from "./recurrence";
import { partsInZone, weekdayIndex, ymdInZone, zonedTimeToUtc } from "./time";
import { withAttendance } from "./attendance";
import type { AppState, AttendanceState, Cadence, Campaign, Invite, Member, Poll, Role, Session, SessionFile, User } from "./types";

export function campaignById(state: AppState, cid: string): Campaign | undefined {
  return state.campaigns.find((c) => c.id === cid);
}

export function membersOf(state: AppState, cid: string): Member[] {
  return dedupeMembers(state.members[cid] ?? [], state.me.id);
}

/**
 * One row per person. Migrated tables can hold two docs for the same email
 * (an old uid and the current one). Keep the doc whose id is the signed-in uid,
 * else the one with a uid, else the first.
 */
export function dedupeMembers(list: Member[], meId = ""): Member[] {
  const byKey = new Map<string, Member>();
  for (const m of list) {
    const key = (m.email || "").toLowerCase() || m.uid || m.id;
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, m); continue; }
    const score = (x: Member) => (x.id === meId ? 4 : 0) + (x.uid === x.id ? 2 : 0) + (x.pending ? -1 : 0) + (x.characterName ? 1 : 0);
    if (score(m) > score(prev)) byKey.set(key, { ...prev, ...m, characterName: m.characterName || prev.characterName });
  }
  return [...byKey.values()];
}

export function myRole(state: AppState, cid: string, uid = state.me.id): Role | null {
  return membersOf(state, cid).find((m) => m.id === uid)?.role ?? null;
}

export function isOrganizer(state: AppState, cid: string, uid = state.me.id): boolean {
  return myRole(state, cid, uid) === "organizer";
}

export function isStaff(state: AppState, cid: string, uid = state.me.id): boolean {
  const role = myRole(state, cid, uid);
  return role === "organizer" || role === "coorganizer";
}

export function canInvite(state: AppState, cid: string, role: Invite["role"], uid = state.me.id): boolean {
  const mine = myRole(state, cid, uid);
  if (!mine) return false;
  if (role === "coorganizer") return mine === "organizer";
  if (mine === "organizer" || mine === "coorganizer") return true;
  const campaign = campaignById(state, cid);
  return mine === "member" && !!campaign?.allowMemberInvites;
}

export function memberCampaigns(state: AppState, uid = state.me.id): Campaign[] {
  return state.campaigns.filter(
    (c) => c.status !== "archived" && (state.members[c.id] ?? []).some((m) => m.id === uid),
  );
}

/** Archived tables the user is still a member of. Restorable by the organizer. */
export function archivedCampaigns(state: AppState, uid = state.me.id): Campaign[] {
  return state.campaigns.filter(
    (c) => c.status === "archived" && (state.members[c.id] ?? []).some((m) => m.id === uid),
  );
}

export function visibleCampaigns(state: AppState, uid = state.me.id): Campaign[] {
  const hidden = new Set(state.hiddenCids);
  return memberCampaigns(state, uid).filter((c) => !hidden.has(c.id));
}

export function replaceSession(state: AppState, session: Session): AppState {
  return { ...state, sessions: state.sessions.map((s) => (s.id === session.id ? session : s)) };
}

export function markAttendance(state: AppState, sessionId: string, uid: string, att: AttendanceState, note?: string, byUid = state.me.id): AppState {
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return state;
  return replaceSession(state, withAttendance(session, uid, att, byUid, note));
}

export function skipSession(state: AppState, sessionId: string): AppState {
  return patchSession(state, sessionId, (s) => ({
    ...s,
    status: "cancelled",
    exception: "skip",
    seq: s.seq + 1,
  }));
}

export function cancelSession(state: AppState, sessionId: string): AppState {
  return patchSession(state, sessionId, (s) => ({
    ...s,
    status: "cancelled",
    exception: "cancel",
    seq: s.seq + 1,
  }));
}

export function restoreSession(state: AppState, sessionId: string): AppState {
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return state;
  const campaign = campaignById(state, session.cid);
  let startsAt = session.startsAt;
  let endsAt = session.endsAt;
  if (session.seriesId && session.occurrenceKey && campaign?.cadence && session.exception === "move") {
    const inst = occurrenceInstant(session.occurrenceKey, campaign.cadence);
    startsAt = inst.startsAt;
    endsAt = inst.endsAt;
  }
  return replaceSession(state, {
    ...session,
    status: "scheduled",
    exception: null,
    startsAt,
    endsAt,
    seq: session.seq + 1,
  });
}

export function moveSession(state: AppState, sessionId: string, ymd: string, hm: string, location?: string): AppState {
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return state;
  const campaign = campaignById(state, session.cid);
  const tz = session.tz || campaign?.tz || "America/Los_Angeles";
  const duration = new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime();
  const start = zonedTimeToUtc(ymd, hm, tz);
  return replaceSession(state, {
    ...session,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + Math.max(duration, 60 * 60_000)).toISOString(),
    location: location ?? session.location,
    status: "scheduled",
    exception: "move",
    seq: session.seq + 1,
  });
}

export function editSession(
  state: AppState,
  sessionId: string,
  patch: Partial<Pick<Session, "title" | "location" | "notes" | "requireRsvps">>,
): AppState {
  return patchSession(state, sessionId, (s) => ({
    ...s,
    ...patch,
    exception: s.seriesId ? "edit" : s.exception ?? null,
  }));
}

function applyRecapPatch(session: Session, patch: RecapPatch): Session {
  const next: Session = { ...session };
  if (patch.recapHtml !== undefined) next.recapHtml = patch.recapHtml;
  if (patch.recapText !== undefined) next.recapText = patch.recapText;
  if (patch.recapMarkdown !== undefined) next.recapMarkdown = patch.recapMarkdown;
  if (patch.pdfPath === null) {
    delete next.pdfPath;
    delete next.pdfName;
    delete next.pdfUrl;
  } else {
    if (typeof patch.pdfPath === "string") next.pdfPath = patch.pdfPath;
    if (patch.pdfName === null) delete next.pdfName;
    else if (typeof patch.pdfName === "string") next.pdfName = patch.pdfName;
    if (patch.pdfUrl === null) delete next.pdfUrl;
    else if (typeof patch.pdfUrl === "string") next.pdfUrl = patch.pdfUrl;
  }
  return next;
}

/** Latest played session that has notes or a PDF. */
export function latestRecap(sessions: Session[], cid: string, now = new Date()): Session | undefined {
  return sessions
    .filter((session) => session.cid === cid && session.status !== "cancelled" && session.startsAt < now.toISOString() && (session.recapText || session.recapHtml || session.recapMarkdown || session.pdfPath || session.pdfName))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
}

/**
 * Save recap text or a PDF without marking the night as a series exception.
 * When this session is the latest played recap, Previously on follows it.
 */
export function saveRecap(state: AppState, sessionId: string, patch: RecapPatch, now = new Date()): AppState {
  const current = state.sessions.find((session) => session.id === sessionId);
  if (!current) return state;
  const session = applyRecapPatch(current, patch);
  let next = replaceSession(state, session);
  const wasSource = state.campaigns.find((campaign) => campaign.id === session.cid)?.previouslyOnSessionId === session.id;
  const latest = latestRecap(next.sessions, session.cid, now);
  if (!latest || (latest.id !== session.id && !wasSource)) return next;
  const text = recapPlain(latest);
  const line = text ? excerpt(text) : latest.pdfName ? `PDF: ${latest.pdfName}` : "";
  if (!line) return next;
  return setCampaignPatch(next, session.cid, { previouslyOn: line, previouslyOnSessionId: latest.id });
}

function patchSession(state: AppState, sessionId: string, fn: (s: Session) => Session): AppState {
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return state;
  return replaceSession(state, fn(session));
}

/**
 * Materialise a weekly cadence into session documents.
 * An existing session on the same local date is attached, never duplicated.
 * Skip / move / cancel / edit exceptions are left untouched.
 */
export function applyCadence(state: AppState, cid: string, cadence: Cadence | null, now = new Date()): AppState {
  const campaign = campaignById(state, cid);
  if (!campaign) return state;
  const others = state.sessions.filter((s) => s.cid !== cid);
  const mine = state.sessions.filter((s) => s.cid === cid);
  if (!cadence) {
    return {
      ...state,
      campaigns: state.campaigns.map((c) => (c.id === cid ? { ...c, cadence: null } : c)),
    };
  }
  const from = ymdInZone(now, cadence.tz);
  const until = horizonEnd(now, cadence.tz, cadence.horizonMonths);
  const dates = cadenceDates(cadence, from, until);
  const historyFrom = state.groupStartedOn.slice(0, 10);
  // Keep already-played series dates that exist; don't invent history here.
  const taken = new Set<string>();
  const kept: Session[] = [];
  for (const session of mine) {
    const key = session.occurrenceKey || ymdInZone(new Date(session.startsAt), session.tz || cadence.tz);
    const onLattice = dates.includes(key) || (session.seriesId && session.occurrenceKey && session.startsAt < now.toISOString());
    if (session.exception && session.seriesId) {
      kept.push(session);
      if (session.occurrenceKey) taken.add(session.occurrenceKey);
      continue;
    }
    if (dates.includes(key)) {
      const inst = occurrenceInstant(key, cadence);
      kept.push({
        ...session,
        seriesId: cadence.id,
        occurrenceKey: key,
        startsAt: session.exception === "move" ? session.startsAt : inst.startsAt,
        endsAt: session.exception === "move" ? session.endsAt : inst.endsAt,
        tz: cadence.tz,
        location: session.exception === "edit" || session.exception === "move" ? session.location : cadence.location,
        status: session.status,
      });
      taken.add(key);
      continue;
    }
    // One-off or historical session. Preserve it.
    if (key < from || !onLattice) kept.push(session);
  }
  const members = membersOf(state, cid);
  const created: Session[] = [];
  for (const ymd of dates) {
    if (taken.has(ymd)) continue;
    if (ymd < historyFrom) continue;
    const inst = occurrenceInstant(ymd, cadence);
    created.push({
      id: `${cid}-${ymd}`,
      cid,
      seriesId: cadence.id,
      occurrenceKey: ymd,
      startsAt: inst.startsAt,
      endsAt: inst.endsAt,
      tz: cadence.tz,
      title: "",
      location: cadence.location,
      status: "scheduled",
      exception: null,
      requireRsvps: null,
      seq: 0,
      attendance: [],
    });
    void members;
  }
  return {
    ...state,
    campaigns: state.campaigns.map((c) => (c.id === cid ? { ...c, cadence, defaultLocation: cadence.location, tz: cadence.tz } : c)),
    sessions: [...others, ...kept, ...created],
  };
}

export function setCampaignPatch(state: AppState, cid: string, patch: Partial<Campaign>): AppState {
  return {
    ...state,
    campaigns: state.campaigns.map((c) => (c.id === cid ? { ...c, ...patch } : c)),
  };
}

export function setMember(state: AppState, cid: string, memberId: string, patch: Partial<Member>): AppState {
  const list = membersOf(state, cid).map((m) => (m.id === memberId ? { ...m, ...patch } : m));
  const next = { ...state, members: { ...state.members, [cid]: list } };
  const name = typeof patch.characterName === "string" ? patch.characterName.trim() : "";
  return name ? rememberCharacter(next, cid, name) : next;
}

/** Exactly one organizer. The previous organizer becomes a co-organizer. */
export function transferOrganizer(state: AppState, cid: string, nextUid: string): AppState {
  if (!isOrganizer(state, cid)) return state;
  const list = membersOf(state, cid).map((m) => {
    if (m.id === nextUid) return { ...m, role: "organizer" as const };
    if (m.role === "organizer") return { ...m, role: "coorganizer" as const };
    return m;
  });
  const next = list.find((m) => m.id === nextUid);
  return {
    ...state,
    members: { ...state.members, [cid]: list },
    campaigns: state.campaigns.map((c) => (c.id === cid ? { ...c, ownerUid: next?.uid ?? nextUid } : c)),
  };
}

export function removeMember(state: AppState, cid: string, memberId: string): AppState {
  if (!isOrganizer(state, cid)) return state;
  if (memberId === state.me.id) return state;
  const list = membersOf(state, cid).filter((m) => m.id !== memberId);
  return { ...state, members: { ...state.members, [cid]: list } };
}

export function createCampaign(state: AppState, input: {
  name: string;
  color: string;
  icon: string;
  tz: string;
  location: string;
  requireRsvps: boolean;
  allowMemberInvites: boolean;
  cadence: Cadence | null;
  kind?: "oneshot";
}): AppState | { error: string } {
  if (!state.me.canCreateCampaigns) return { error: "Only people on the organizer list can start a campaign." };
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "campaign";
  let id = slug;
  let n = 2;
  while (state.campaigns.some((c) => c.id === id)) id = `${slug}-${n++}`;
  const campaign: Campaign = {
    id,
    orgId: null,
    name: input.name.trim(),
    slug: id,
    color: input.color,
    icon: input.icon || "🎲",
    cover: { src: "", path: null, focalX: 0.5, focalY: 0.5 },
    defaultLocation: input.location,
    tz: input.tz,
    ownerUid: state.me.id,
    status: "active",
    allowMemberInvites: input.allowMemberInvites,
    requireRsvps: input.requireRsvps,
    cadence: null,
    discord: null,
    ...(input.kind === "oneshot" ? { kind: "oneshot" as const } : {}),
  };
  const member: Member = {
    id: state.me.id,
    uid: state.me.id,
    email: state.me.email,
    displayName: state.me.displayName,
    role: "organizer",
    tags: [],
    joinedAt: new Date().toISOString(),
  };
  let next: AppState = {
    ...state,
    campaigns: [...state.campaigns, campaign],
    members: { ...state.members, [id]: [member] },
  };
  if (input.cadence) next = applyCadence(next, id, { ...input.cadence, id: `${id}-series`, location: input.location, tz: input.tz });
  return next;
}

export function toggleVote(state: AppState, pollId: string, optionId: string, uid = state.me.id): AppState {
  return {
    ...state,
    polls: state.polls.map((p) => {
      if (p.id !== pollId || p.status !== "open") return p;
      const mine = p.votes[uid] ?? { picks: {}, updatedAt: new Date().toISOString() };
      const picks = { ...mine.picks, [optionId]: !mine.picks[optionId] };
      return { ...p, votes: { ...p.votes, [uid]: { picks, updatedAt: new Date().toISOString() } } };
    }),
  };
}

export function rankedOptions(poll: Poll, cadence: Cadence | null): { option: Poll["options"][number]; yes: number }[] {
  return poll.options
    .map((option) => {
      let yes = 0;
      for (const vote of Object.values(poll.votes)) if (vote.picks[option.id]) yes += 1;
      return { option, yes };
    })
    .sort((a, b) => {
      if (b.yes !== a.yes) return b.yes - a.yes;
      const aUsual = cadence ? usualScore(a.option.startsAt, cadence) : 0;
      const bUsual = cadence ? usualScore(b.option.startsAt, cadence) : 0;
      if (bUsual !== aUsual) return bUsual - aUsual;
      return a.option.startsAt.localeCompare(b.option.startsAt);
    });
}

function usualScore(iso: string, cadence: Cadence): number {
  const p = partsInZone(new Date(iso), cadence.tz);
  const dow = weekdayIndex(p.weekday);
  const hm = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  let score = 0;
  if (dow === cadence.weekday) score += 2;
  if (hm === cadence.startTime) score += 1;
  return score;
}

export function lockPoll(state: AppState, pollId: string, optionId: string): AppState | { error: string } {
  const poll = state.polls.find((p) => p.id === pollId);
  if (!poll) return { error: "That poll is gone." };
  if (!isStaff(state, poll.cid)) return { error: "Only an Organizer or Co-organizer can lock a date." };
  const option = poll.options.find((o) => o.id === optionId);
  if (!option) return { error: "Pick one of the dates first." };
  const campaign = campaignById(state, poll.cid);
  const session: Session = {
    id: `${poll.cid}-poll-${option.id}`,
    cid: poll.cid,
    seriesId: null,
    occurrenceKey: null,
    startsAt: option.startsAt,
    endsAt: option.endsAt && new Date(option.endsAt).getTime() > new Date(option.startsAt).getTime()
      ? option.endsAt
      : new Date(new Date(option.startsAt).getTime() + 4 * 3600_000).toISOString(),
    tz: option.tz,
    title: poll.title.replace(/dates$/i, "").trim() || campaign?.name || "Session",
    location: campaign?.defaultLocation ?? "",
    status: "scheduled",
    exception: null,
    requireRsvps: null,

    seq: 0,
    attendance: [],
    notes: "Locked in from a date poll.",
  };
  return {
    ...state,
    sessions: [...state.sessions.filter((s) => s.id !== session.id), session],
    polls: state.polls.map((p) => (p.id === pollId ? { ...p, status: "locked", chosenOptionId: optionId, sessionId: session.id } : p)),
  };
}

export function addPoll(state: AppState, cid: string, title: string, options: Poll["options"]): AppState | { error: string } {
  if (!isStaff(state, cid)) return { error: "Only an Organizer or Co-organizer can start a poll." };
  if (options.length < 2) return { error: "Add at least two dates." };
  const poll: Poll = {
    id: `poll-${cid}-${Date.now().toString(36)}`,
    cid,
    title,
    options,
    status: "open",
    createdBy: state.me.id,
    votes: {},
    nudges: {},
  };
  return { ...state, polls: [...state.polls, poll] };
}

export function nudgePoll(state: AppState, pollId: string, uid: string): AppState {
  return {
    ...state,
    polls: state.polls.map((p) => (p.id === pollId ? { ...p, nudges: { ...(p.nudges ?? {}), [uid]: new Date().toISOString() } } : p)),
  };
}

export function createInvite(state: AppState, cid: string, role: Invite["role"], email?: string): AppState | { error: string } {
  if (!canInvite(state, cid, role)) {
    return { error: role === "coorganizer" ? "Only the Organizer can invite a Co-organizer." : "Invites are off for members." };
  }
  const token = `${cid}-${Math.random().toString(36).slice(2, 8)}`;
  const invite: Invite = {
    token,
    cid,
    email: email?.trim() || null,
    role,
    createdBy: state.me.id,
    createdByName: state.me.displayName,
    expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    maxUses: email ? 1 : 5,
    uses: 0,
    status: "pending",
  };
  return { ...state, invites: [...state.invites, invite] };
}

export function acceptInvite(state: AppState, token: string, person: { id: string; email: string; displayName: string; characterName?: string }): AppState | { error: string } {
  const invite = state.invites.find((i) => i.token === token);
  if (!invite || invite.status !== "pending") return { error: "This invite isn't open." };
  if (new Date(invite.expiresAt).getTime() < Date.now()) return { error: "This invite has expired." };
  if (invite.uses >= invite.maxUses) return { error: "This invite has been used up." };
  if (invite.email && invite.email.toLowerCase() !== person.email.toLowerCase()) {
    return { error: "This invite was sent to a different email." };
  }
  const existing = membersOf(state, invite.cid).find((m) => m.id === person.id || m.email.toLowerCase() === person.email.toLowerCase());
  if (existing) {
    return {
      ...state,
      invites: state.invites.map((i) => (i.token === token ? { ...i, status: "accepted", uses: i.uses + 1 } : i)),
    };
  }
  const member: Member = {
    id: person.id,
    uid: person.id,
    email: person.email,
    displayName: person.displayName,
    characterName: person.characterName,
    role: invite.role,
    tags: [],
    joinedAt: new Date().toISOString(),
  };
  const joined: AppState = {
    ...state,
    invites: state.invites.map((i) => (i.token === token ? { ...i, status: "accepted" as const, uses: i.uses + 1 } : i)),
    members: { ...state.members, [invite.cid]: [...membersOf(state, invite.cid), member] },
  };
  return person.characterName?.trim() ? rememberCharacter(joined, invite.cid, person.characterName) : joined;
}

export function upcomingSessions(state: AppState, cid?: string, now = new Date()): Session[] {
  const allowed = new Set(visibleCampaigns(state).map((c) => c.id));
  return state.sessions
    .filter((s) => s.status === "scheduled" && new Date(s.endsAt).getTime() >= now.getTime())
    .filter((s) => allowed.has(s.cid))
    .filter((s) => !cid || s.cid === cid)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function pastSessions(state: AppState, cid?: string, now = new Date()): Session[] {
  const allowed = new Set((cid ? state.campaigns.filter((c) => c.id === cid) : memberCampaigns(state)).map((c) => c.id));
  return state.sessions
    .filter((s) => allowed.has(s.cid))
    .filter((s) => cid ? s.cid === cid : true)
    .filter((s) => new Date(s.endsAt).getTime() < now.getTime())
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

export function userById(state: AppState, id: string): User | undefined {
  return state.directory.find((u) => u.id === id);
}

export function displayOf(state: AppState, cid: string, uid: string): string {
  const member = membersOf(state, cid).find((m) => m.id === uid);
  if (member?.characterName && member.characterName !== member.displayName) {
    return `${member.characterName} (${member.displayName})`;
  }
  return member?.displayName ?? userById(state, uid)?.displayName ?? "Someone";
}


/** Every PDF attached to a night, primary first. Never repeats a path. */
export function sessionFiles(session: Session): SessionFile[] {
  const out: SessionFile[] = [];
  const seen = new Set<string>();
  if (session.pdfPath) {
    out.push({ path: session.pdfPath, name: session.pdfName || fileName(session.pdfPath), size: session.pdfSize, pages: session.pdfPages });
    seen.add(session.pdfPath);
  } else if (session.pdfUrl) {
    out.push({ path: session.pdfUrl, name: session.pdfName || fileName(session.pdfUrl) });
    seen.add(session.pdfUrl);
  }
  for (const f of session.extraPdfs || []) {
    if (seen.has(f.path)) continue;
    seen.add(f.path);
    out.push({ ...f, name: f.name || fileName(f.path) });
  }
  return out;
}

function fileName(path: string): string {
  const base = path.split("/").pop() || "Recap.pdf";
  return decodeURIComponent(base).replace(/^\d{4}-\d{2}-\d{2}_/, "").replace(/_/g, " ");
}

export function addSessionFile(state: AppState, sessionId: string, file: SessionFile): AppState {
  return patchSession(state, sessionId, (s) => {
    if (!s.pdfPath && !s.pdfUrl) return { ...s, pdfPath: file.path, pdfName: file.name, pdfSize: file.size, pdfPages: file.pages };
    return { ...s, extraPdfs: [...(s.extraPdfs || []).filter((f) => f.path !== file.path), file] };
  });
}

export function removeSessionFile(state: AppState, sessionId: string, path: string): AppState {
  return patchSession(state, sessionId, (s) => {
    const next: Session = { ...s, extraPdfs: (s.extraPdfs || []).filter((f) => f.path !== path) };
    if (s.pdfPath === path || (!s.pdfPath && s.pdfUrl === path)) {
      delete next.pdfPath; delete next.pdfName; delete next.pdfUrl; delete next.pdfSize; delete next.pdfPages;
      const [first, ...rest] = next.extraPdfs || [];
      if (first) { next.pdfPath = first.path; next.pdfName = first.name; if (first.size) next.pdfSize = first.size; if (first.pages) next.pdfPages = first.pages; next.extraPdfs = rest; }
    }
    return next;
  });
}

export function replaceSessionFile(state: AppState, sessionId: string, oldPath: string, file: SessionFile): AppState {
  return patchSession(state, sessionId, (s) => {
    if (s.pdfPath === oldPath || (!s.pdfPath && s.pdfUrl === oldPath)) {
      const next: Session = { ...s, pdfPath: file.path, pdfName: file.name };
      delete next.pdfUrl;
      if (file.size) next.pdfSize = file.size; else delete next.pdfSize;
      if (file.pages) next.pdfPages = file.pages; else delete next.pdfPages;
      return next;
    }
    return { ...s, extraPdfs: (s.extraPdfs || []).map((f) => (f.path === oldPath ? file : f)) };
  });
}

export function leaveCampaign(state: AppState, cid: string): AppState | { error: string } {
  const me = membersOf(state, cid).find((m) => m.id === state.me.id);
  if (!me) return { error: "You're not at this table." };
  if (me.role === "organizer") return { error: "Hand the table to someone else before you leave." };
  return { ...state, members: { ...state.members, [cid]: (state.members[cid] || []).filter((m) => m.id !== state.me.id) } };
}

export function deleteCampaignLocal(state: AppState, cid: string): AppState {
  const { [cid]: _gone, ...members } = state.members;
  void _gone;
  return {
    ...state,
    campaigns: state.campaigns.filter((c) => c.id !== cid),
    sessions: state.sessions.filter((s) => s.cid !== cid),
    polls: state.polls.filter((p) => p.cid !== cid),
    invites: state.invites.filter((i) => i.cid !== cid),
    members,
  };
}

/** True when the campaign has an organizer-uploaded cover. Generated plates count as no cover. */
export function hasUploadedCover(campaign: Campaign): boolean {
  if (campaign.cover?.path) return true;
  const src = campaign.cover?.src || "";
  return src.startsWith("data:") || src.startsWith("blob:");
}

/** The session's own title, or "" when it has none (or only repeats the campaign name). */
export function ownTitle(session: Pick<Session, "title">, campaignName = ""): string {
  const t = (session.title || "").trim();
  return t && t.toLowerCase() !== campaignName.trim().toLowerCase() && t.toLowerCase() !== "session" ? t : "";
}

/** How a session is named on screen and in emails/feeds: its own subtitle with any "Session #N" numbering dropped, else the campaign name. Display only. */
export function displayTitle(session: Pick<Session, "title">, campaignName: string): string {
  const own = ownTitle(session, campaignName).replace(/^session\s*#?\s*\d+(\s*of\s*\d+)?\s*[·:\-–—]?\s*/i, "").trim();
  return own || campaignName;
}

/** What to call a session: its own title, else "Session N" counted within its campaign. */
export function sessionTitle(state: AppState, session: Session): string {
  const campaign = state.campaigns.find((c) => c.id === session.cid);
  const own = ownTitle(session, campaign?.name);
  if (own) return own;
  const n = state.sessions.filter((s) => s.cid === session.cid && s.status !== "cancelled" && s.startsAt < session.startsAt).length + 1;
  return `Session ${n}`;
}
