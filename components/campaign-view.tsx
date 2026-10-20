"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isOrganizer, isStaff, membersOf, pastSessions, upcomingSessions } from "@/lib/model";
import { excerpt, hasRecap, recapPlain } from "@/lib/recap";
import { useStore } from "@/lib/store";
import { groupStats } from "@/lib/stats";
import { weekdayName } from "@/lib/time";
import type { Cadence, Member, Session, TableCharacter } from "@/lib/types";
import { weekdayOfYmd } from "@/lib/recurrence";
import { addDaysYmd } from "@/lib/time";
import { coverArt } from "@/lib/covers";
import { PlayRow } from "./schedule";

export function CampaignView({ cid, welcome = false }: { cid: string; welcome?: boolean }) {
  const store = useStore();
  const campaign = store.state.campaigns.find((c) => c.id === cid);
  const member = (store.state.members[cid] || []).find((m) => m.id === store.state.me.id);
  if (!campaign || !member) {
    return (
      <div className="card">
        <h1>You&apos;re not at this table</h1>
        <p>Campaigns only show up after an invite. If you have a link, open that.</p>
        <Link className="b" href="/">Back to play dates</Link>
      </div>
    );
  }
  const upcoming = upcomingSessions(store.state, cid);
  const past = pastSessions(store.state, cid);
  const stats = groupStats(store.state.sessions.filter((s) => (store.state.members[s.cid] || []).some((m) => m.id === store.state.me.id)));
  const cadence = campaign.cadence;
  const staff = isStaff(store.state, cid);
  const organizer = isOrganizer(store.state, cid);
  return (
    <>
      {welcome && <div className="todo"><b>You&apos;re in.</b> Add the nights to your calendar whenever you like.</div>}
      <section className="banner" style={{ ["--c" as string]: campaign.color, ["--img" as string]: `url(${coverArt(campaign.cover.src)})` }}>
        <div className="art" role="img" aria-label={campaign.cover.credit || campaign.name} />
        <div className="tx">
          <small>
            Organized by {organizerName(store.state.members[cid])}
            {cadence ? ` · Every ${cadence.interval === 2 ? "other " : cadence.interval > 2 ? `${cadence.interval} ` : ""}${weekdayName(cadence.weekday)} ${prettyTime(cadence.startTime)}` : ""}
            {campaign.defaultLocation ? ` · ${campaign.defaultLocation}` : ""}
          </small>
          <h1>{campaign.icon} {campaign.name}</h1>
        </div>
      </section>
      <div className="two">
        <div>
          <div className="card ann">
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
              <b>Two years at this table</b>
              <span className="tz" style={{ marginLeft: "auto" }}>since {store.state.groupStartedOn.slice(0, 7)} · all your campaigns together</span>
            </div>
            <div className="hist" style={{ marginTop: 12 }}>
              <div><b>{stats.played}</b><small>sessions</small></div>
              <div><b>{stats.hours}</b><small>hours played</small></div>
              <div><b>{stats.streak}</b><small>streak</small></div>
              <div><b>{campaign.partyLevel ? `Lv ${campaign.partyLevel}` : "—"}</b><small>party level</small></div>
            </div>
            <div className="dots" style={{ ["--c" as string]: campaign.color }}>
              {stats.dots.map((dot) => <i key={dot.id} className={dot.played ? "" : "miss"} title={dot.played ? "Played" : "Skipped"} />)}
            </div>
            <p className="tz" style={{ marginTop: 8 }}>Every square is a game night. Grey ones were skipped.</p>
          </div>
          <div className="mh">
            <h2 style={{ margin: 0 }}>Play dates</h2>
            {staff && <CadenceButton cid={cid} />}
          </div>
          {upcoming.map((session) => <PlayRow key={session.id} session={session} manage />)}
          {upcoming.length === 0 && <div className="card">No upcoming play dates. {staff ? "Set the cadence and the nights fill in." : "The organizer hasn't set the next nights yet."}</div>}
          <RecapHistory cid={cid} past={past} />
          {staff && (
            <Previously cid={cid} value={campaign.previouslyOn || ""} />
          )}
        </div>
        <div>
          <CalendarCard cid={cid} />
          <PartyCard cid={cid} />
        </div>
      </div>
    </>
  );
}

function organizerName(members: Member[]): string {
  return members.find((m) => m.role === "organizer")?.displayName ?? "the organizer";
}

function prettyTime(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ap}`;
}

function CadenceButton({ cid }: { cid: string }) {
  const store = useStore();
  const campaign = store.state.campaigns.find((c) => c.id === cid)!;
  const [open, setOpen] = useState(false);
  const cadence = campaign.cadence;
  const [interval, setInterval] = useState(cadence?.interval ?? 2);
  const [weekday, setWeekday] = useState(cadence?.weekday ?? 5);
  const [startTime, setStart] = useState(cadence?.startTime ?? "18:30");
  const [durationMin, setDuration] = useState(cadence?.durationMin ?? 240);
  const [location, setLocation] = useState(cadence?.location || campaign.defaultLocation);
  const [tz, setTz] = useState(cadence?.tz || campaign.tz);
  const [horizonMonths, setHorizon] = useState(cadence?.horizonMonths ?? 4);
  const save = () => {
    let anchor = campaign.cadence?.anchorDate || new Date().toISOString().slice(0, 10);
    const delta = (Number(weekday) - weekdayOfYmd(anchor) + 7) % 7;
    if (delta) anchor = addDaysYmd(anchor, delta);
    const next: Cadence = {
      id: campaign.cadence?.id || `${cid}-series`,
      freq: "weeks",
      interval: Number(interval),
      weekday: Number(weekday),
      startTime,
      durationMin: Number(durationMin),
      tz,
      anchorDate: anchor,
      horizonMonths: Number(horizonMonths),
      location,
    };
    store.saveCadence(cid, next);
    setOpen(false);
  };
  return (
    <>
      <button className="b p" style={{ marginLeft: "auto" }} onClick={() => setOpen((v) => !v)}>{cadence ? "Edit the series" : "+ Series"}</button>
      {open && (
        <div className="sheet" style={{ flexBasis: "100%" }}>
          <b>The usual night</b>
          <p className="tz">Set it once. Nights fill in on their own. Skipping or moving one date leaves the rest alone.</p>
          <div className="field">
            <label>Every</label>
            <select value={interval} onChange={(e) => setInterval(Number(e.target.value))} aria-label="Repeat interval">
              <option value={1}>week</option>
              <option value={2}>other week</option>
              <option value={3}>3 weeks</option>
              <option value={4}>4 weeks</option>
            </select>
          </div>
          <div className="field">
            <label>On</label>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} aria-label="Weekday">
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((name, i) => <option key={name} value={i}>{name}</option>)}
            </select>
          </div>
          <div className="field"><label>Starts</label><input type="time" value={startTime} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field">
            <label>Length (minutes)</label>
            <input type="number" min={60} step={30} value={durationMin} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div className="field"><label>Place</label><input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="field">
            <label>Time zone</label>
            <input value={tz} onChange={(e) => setTz(e.target.value)} list="zones" />
            <datalist id="zones">
              <option value="America/Los_Angeles" />
              <option value="America/Denver" />
              <option value="America/Chicago" />
              <option value="America/New_York" />
            </datalist>
          </div>
          <div className="field"><label>Plan this many months ahead</label><input type="number" min={1} max={12} value={horizonMonths} onChange={(e) => setHorizon(Number(e.target.value))} /></div>
          <button className="b p" onClick={save}>Save the series</button>
        </div>
      )}
    </>
  );
}

function RecapHistory({ cid, past }: { cid: string; past: Session[] }) {
  const recaps = past.filter((session) => hasRecap(session));
  const unwritten = past.filter((session) => session.status !== "cancelled" && !hasRecap(session)).slice(0, 4);
  return (
    <div className="card">
      <b>Recaps · {recaps.length}</b>
      <p className="tz">Notes and PDFs from nights already played. {past.filter((session) => session.status !== "cancelled").length} sessions on the books.</p>
      <div className="recap-list">
        {recaps.map((session) => (
          <Link key={session.id} href={`/campaigns/${cid}/sessions/${session.id}`}>
            <span className="tz">{session.occurrenceKey}</span>
            <span>
              <h3>{session.title}</h3>
              <p>{excerpt(recapPlain(session), 140) || "PDF recap"}</p>
            </span>
            {session.pdfName ? <span className="chip">PDF</span> : <span />}
          </Link>
        ))}
        {recaps.length === 0 && <p>No recaps yet.</p>}
        {unwritten.map((session) => (
          <Link key={session.id} href={`/campaigns/${cid}/sessions/${session.id}`}>
            <span className="tz">{session.occurrenceKey}</span>
            <span>
              <h3>{session.title}</h3>
              <p className="tz">No recap yet</p>
            </span>
            <span />
          </Link>
        ))}
      </div>
    </div>
  );
}

function Previously({ cid, value }: { cid: string; value: string }) {
  const store = useStore();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="card">
      <b>Previously on…</b>
      <div className="field">
        <label htmlFor="previously">One line for the next session and the reminder email. Saving the latest recap fills this in again.</label>
        <textarea id="previously" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <button className="b" onClick={() => store.patchCampaign(cid, { previouslyOn: text })}>Save the teaser</button>
    </div>
  );
}

function CalendarCard({ cid }: { cid: string }) {
  const { state } = useStore();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const token = state.me.calToken;
  const http = `${origin}/api/cal/${token}/${cid}.ics`;
  const webcal = origin ? http.replace(/^https?:/, "webcal:") : http;
  const [copied, setCopied] = useState(false);
  return (
    <div className="card sub">
      <h3 style={{ margin: "0 0 4px" }}>Add to your calendar</h3>
      <p className="tz">Just this campaign&apos;s play dates. Changes update on their own. Google refreshes subscribed calendars slowly, often a few hours.</p>
      <a className="cal" href={webcal}>Apple / Outlook (webcal)</a>
      <a className="cal" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}>Google Calendar</a>
      <div className="url">
        <input readOnly value={webcal} aria-label="Calendar feed URL" />
        <button className="b" onClick={() => { void navigator.clipboard.writeText(webcal); setCopied(true); }}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function PartyCard({ cid }: { cid: string }) {
  const store = useStore();
  const members = membersOf(store.state, cid);
  const campaign = store.state.campaigns.find((c) => c.id === cid)!;
  const organizer = isOrganizer(store.state, cid);
  const me = members.find((m) => m.id === store.state.me.id);
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Party · {members.length}</h3>
        {(organizer || campaign.allowMemberInvites || me?.role === "coorganizer") && (
          <Link className="b" style={{ marginLeft: "auto" }} href={`/invites?campaign=${cid}`}>+ Invite</Link>
        )}
      </div>
      {members.map((m) => (
        <div className="mem" key={m.id}>
          <span className="av" aria-hidden>{(m.characterName || m.displayName).slice(0, 1)}</span>
          <div>
            <b>{m.characterName && m.characterName !== m.displayName ? `${m.characterName} (${m.displayName})` : m.displayName}</b>
            {m.tags.includes("dm") && <span className="role" title="Optional tag. No permissions."> DM</span>}
            {m.id === store.state.me.id && <span className="tz"> · you</span>}
          </div>
          <div className="tools">
            {m.role === "organizer" ? <span className="role dm">Organizer</span> : organizer ? (
              <select aria-label={`Role for ${m.displayName}`} value={m.role} onChange={(e) => store.patchMember(cid, m.id, { role: e.target.value as Member["role"] })}>
                <option value="coorganizer">Co-organizer</option>
                <option value="member">Member</option>
              </select>
            ) : <span className="role">{m.role === "coorganizer" ? "Co-organizer" : "Member"}</span>}
            {organizer && m.role !== "organizer" && <button className="x" onClick={() => store.removeMember(cid, m.id)}>Remove</button>}
          </div>
        </div>
      ))}
      {campaign.characters && campaign.characters.length > 0 && <CharacterRoster characters={campaign.characters} />}
      {organizer && (
        <>
          <Toggle
            on={campaign.allowMemberInvites}
            title="Members can invite others"
            detail="Off means only you and co-organizers invite."
            onClick={() => store.patchCampaign(cid, { allowMemberInvites: !campaign.allowMemberInvites })}
          />
          <Toggle
            on={campaign.requireRsvps}
            title="Require RSVPs"
            detail="Off: everyone is assumed in until they tap Can't make it. On: players have to say they're coming. You can still override one session."
            onClick={() => store.patchCampaign(cid, { requireRsvps: !campaign.requireRsvps })}
          />
          <Toggle
            on={campaign.rotation.enabled}
            title="Snack rotation"
            detail={campaign.rotation.enabled ? `Next up rotates through ${campaign.rotation.order.map((id) => members.find((m) => m.id === id)?.displayName || id).join(", ")}.` : "Assigns the next person on each generated night."}
            onClick={() => store.patchCampaign(cid, { rotation: { ...campaign.rotation, enabled: !campaign.rotation.enabled, order: campaign.rotation.order.length ? campaign.rotation.order : members.map((m) => m.id) } })}
          />
          <div className="field">
            <label htmlFor="transfer">Transfer organizer</label>
            <select id="transfer" defaultValue="" onChange={(e) => { if (e.target.value) store.transfer(cid, e.target.value); }}>
              <option value="">Keep it</option>
              {members.filter((m) => m.role !== "organizer").map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
            </select>
          </div>
          <p className="tz"><b>Organizer</b> runs the table&apos;s schedule: roles, removal, the series. <b>Co-organizer</b> adds and edits play dates and polls. <b>Member</b> sees the schedule, marks themselves out, and invites if you allow it. The DM tag is optional and grants nothing.</p>
          <DmTags cid={cid} />
        </>
      )}
    </div>
  );
}

function DmTags({ cid }: { cid: string }) {
  const store = useStore();
  const members = membersOf(store.state, cid);
  return (
    <div className="field">
      <label>DM tag</label>
      <div className="row-actions">
        {members.map((m) => {
          const on = m.tags.includes("dm");
          return (
            <button key={m.id} className="b" aria-pressed={on} onClick={() => {
              const tags = on ? m.tags.filter((t) => t !== "dm") : [...m.tags, "dm"];
              store.patchMember(cid, m.id, { tags });
            }}>{on ? "Remove DM" : "Tag DM"} · {m.displayName}</button>
          );
        })}
      </div>
    </div>
  );
}

function characterLine(character: TableCharacter): string {
  return [character.charClass, character.subclass, character.level ? `level ${character.level}` : ""].filter(Boolean).join(" · ");
}

function CharacterRoster({ characters }: { characters: TableCharacter[] }) {
  return (
    <div>
      <h3 style={{ margin: "14px 0 0" }}>Characters · {characters.length}</h3>
      <p className="tz">The table&apos;s characters, in roster order. These are not accounts.</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {characters.map((character) => {
          const line = characterLine(character);
          return (
            <li className="mem" key={character.name}>
              <span className="av" aria-hidden>{character.name.slice(0, 1)}</span>
              <div>
                <b>{character.name}</b>
                {character.leyfarer && <span className="role"> Leyfarer</span>}
                <div className="tz">{line || "No class on file"}{character.imagePath ? ` · portrait ${character.imagePath}` : ""}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Toggle({ on, title, detail, onClick }: { on: boolean; title: string; detail: string; onClick: () => void }) {
  return (
    <div className="tog">
      <span><b>{title}</b><br /><span className="tz">{detail}</span></span>
      <button className="switch" role="switch" aria-checked={on} aria-label={title} onClick={onClick}><i /></button>
    </div>
  );
}

