"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasUploadedCover, isOrganizer, isStaff, membersOf, pastSessions, sessionFiles, upcomingSessions, displayTitle } from "@/lib/model";
import { excerpt, hasRecap, recapPlain } from "@/lib/recap";
import { isUnread, readingMinutes, seedReads } from "@/lib/read-marks";
import { useStore } from "@/lib/store";
import { formatDayHeading, weekdayName } from "@/lib/time";
import { weekdayOfYmd } from "@/lib/recurrence";
import { addDaysYmd } from "@/lib/time";
import type { Cadence, Campaign, Member, Session } from "@/lib/types";
import { CoverEditor } from "./cover-editor";
import { SessionRow, sessionHref } from "./schedule";
import { Avatar, BackBar, CampaignCover, Icon, SettingRow, Switch } from "./ui";

export function CampaignView({ cid, welcome = false }: { cid: string; welcome?: boolean }) {
  const store = useStore();
  const { state } = store;
  const campaign = state.campaigns.find((c) => c.id === cid);
  const me = membersOf(state, cid).find((m) => m.id === state.me.id);
  const [covering, setCovering] = useState(false);
  const [editing, setEditing] = useState(false);
  const allRecaps = pastSessions(state, cid).filter((s) => hasRecap(s));
  const recapKey = allRecaps.map((s) => s.id + (s.recapText || "").length + (s.pdfPath || "")).join("|");
  const [unread, setUnread] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (state.syncing || !allRecaps.length) return;
    seedReads(allRecaps);
    setUnread(new Set(allRecaps.filter(isUnread).map((s) => s.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recapKey, state.syncing]);
  if (!campaign || !me) {
    return (
      <>
        <BackBar href="/campaigns" label="Campaigns" />
        <div className="card empty-card">
          <h1 className="lt">You&apos;re not at this table</h1>
          <p className="note">Campaigns show up after an invite. If you have a link, open that.</p>
          <Link className="btn pri sm" href="/campaigns">Go to Campaigns</Link>
        </div>
      </>
    );
  }
  const organizer = isOrganizer(state, cid);
  const staff = isStaff(state, cid);
  const members = membersOf(state, cid);
  const owner = members.find((m) => m.role === "organizer");
  const upcoming = upcomingSessionsAll(state, cid);
  const shown = upcoming.slice(0, 1);
  const recaps = pastSessions(state, cid).filter((s) => hasRecap(s));
  const unwritten = pastSessions(state, cid).find((s) => s.status !== "cancelled" && !hasRecap(s));
  const archived = campaign.status === "archived";

  return (
    <>
      <BackBar href="/campaigns" label="Campaigns" />
      {welcome && <div className="card banner"><b>You&apos;re in.</b> <span className="note">Your sessions are on the Sessions tab.</span></div>}
      {archived && (
        <div className="card banner">
          <b>Archived.</b> <span className="note">Hidden from Sessions, and reminders are off.</span>
          {organizer && <button className="btn sec sm" onClick={() => store.archiveCampaign(cid, false)}>Restore</button>}
        </div>
      )}
      <section className="card hero chead">
        <div className="hero-cover">
          <CampaignCover campaign={campaign} onAdd={organizer ? () => setCovering(true) : undefined} />
          {organizer && hasUploadedCover(campaign) && <button className="btn sec sm covbtn" onClick={() => setCovering(true)}><Icon name="img" className="ic sm" />Change cover</button>}
        </div>
        <div className="hb">
          <div className="eyebrow">Campaign · {owner?.id === state.me.id ? "You run this table" : `${owner?.displayName || "The organizer"} runs this table`}</div>
          <h1 className="lt">{campaign.name}</h1>
          <p className="meta">
            <span className="mg"><Icon name="clock" className="ic sm" />{cadenceLine(campaign.cadence)}</span>
            {(campaign.cadence?.location || campaign.defaultLocation) && <span className="mg"><Icon name="pin" className="ic sm" />{campaign.cadence?.location || campaign.defaultLocation}</span>}
          </p>
          {organizer && !editing && <button className="btn sec sm edt" onClick={() => setEditing(true)}><Icon name="quill" className="ic sm" />Edit details</button>}
          {organizer && editing && <DetailsForm campaign={campaign} onDone={() => setEditing(false)} />}
        </div>
      </section>
      {covering && <CoverEditor campaign={campaign} onClose={() => setCovering(false)} />}

      <div className="sgrid cgrid">
        <div className="scol">
          <div className="sh secth"><h2>Coming up</h2></div>
          {upcoming.length > 0 ? (
            <div className="card list">{shown.map((s) => <SessionRow key={s.id} session={s} />)}</div>
          ) : (
            <div className="card pad"><p className="note">{organizer ? "Set the usual night in Edit details and the sessions fill in." : "No sessions scheduled yet."}</p></div>
          )}
          {upcoming.length > 0 && (
            <Link className="lnk seeall" href={`/sessions?campaign=${encodeURIComponent(cid)}`}>
              See all sessions <Icon name="arrow" className="ic sm" />
            </Link>
          )}

          <div className="sh secth">
            <h2>Recaps</h2>
            {staff && unwritten && <Link className="btn sec sm" href={sessionHref(unwritten)}><Icon name="plus" className="ic sm" />Add recap</Link>}
          </div>
          {recaps.length > 0 ? (
            <>
              <div className={recaps.length > 1 ? "card list tline" : "card list"}>
                {recaps.slice(0, 2).map((s) => <RecapRow key={s.id} session={s} unread={unread.has(s.id)} />)}
              </div>
              {recaps.length > 1 && (
                <Link className="lnk seeall" href={`/campaigns/${encodeURIComponent(cid)}/recaps`}>
                  All {recaps.length} recaps <Icon name="arrow" className="ic sm" />
                </Link>
              )}
            </>
          ) : (
            <div className="card pad"><p className="note">No recaps yet.</p></div>
          )}
        </div>
        <aside className="cside">
          {organizer ? <OrganizerPanel campaign={campaign} members={members} me={me} /> : <PlayerPanel campaign={campaign} me={me} members={members} />}
        </aside>
      </div>
    </>
  );
}

/** One recap in a list: date, title, a line of the text, reading time, PDF badge. */
export function RecapRow({ session: s, unread = false }: { session: Session; unread?: boolean }) {
  const store = useStore();
  const when = formatDayHeading(s.startsAt, s.tz);
  const text = excerpt(recapPlain(s), 90);
  return (
    <Link className="srow rrow" href={sessionHref(s)}>
      <span className="st">
        <span className="cn">{`${when.dow[0]}${when.dow.slice(1).toLowerCase()} ${when.mon[0]}${when.mon.slice(1).toLowerCase()} ${when.day}`}</span>
        <b>{displayTitle(s, store.state.campaigns.find((c) => c.id === s.cid)?.name || "")}{unread && <span className="newpill">New</span>}</b>
        {text && <span className="note">{text}</span>}
        {readingMinutes(s) > 1 && <span className="rmin">{readingMinutes(s)} min read</span>}
      </span>
      {sessionFiles(s).length > 0 && <span className="ficon sm" aria-label="Has a PDF">PDF</span>}
    </Link>
  );
}

function upcomingSessionsAll(state: ReturnType<typeof useStore>["state"], cid: string) {
  const now = Date.now();
  return state.sessions
    .filter((s) => s.cid === cid && s.status === "scheduled" && new Date(s.endsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
void upcomingSessions;

function cadenceLine(cadence: Cadence | null): string {
  if (!cadence) return "No usual night yet";
  const every = cadence.interval === 1 ? "Every" : cadence.interval === 2 ? "Every other" : `Every ${cadence.interval} weeks on`;
  return `${every} ${weekdayName(cadence.weekday)}, ${prettyTime(cadence.startTime)}`;
}

function prettyTime(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function DetailsForm({ campaign, onDone }: { campaign: Campaign; onDone: () => void }) {
  const store = useStore();
  const c = campaign.cadence;
  const [name, setName] = useState(campaign.name);
  const [place, setPlace] = useState(c?.location || campaign.defaultLocation || "");
  const [repeat, setRepeat] = useState(Boolean(c));
  const [interval, setIntervalN] = useState(c?.interval ?? 2);
  const [weekday, setWeekday] = useState(c?.weekday ?? 5);
  const [start, setStart] = useState(c?.startTime ?? "18:30");
  const [length, setLength] = useState(c?.durationMin ?? 240);
  return (
    <form
      className="dform"
      onSubmit={(e) => {
        e.preventDefault();
        const clean = name.trim() || campaign.name;
        store.patchCampaign(campaign.id, { name: clean, defaultLocation: place });
        const same = c && c.interval === interval && c.weekday === weekday && c.startTime === start && c.durationMin === length && c.location === place;
        if (repeat && !same) {
          let anchor = c?.anchorDate || new Date().toISOString().slice(0, 10);
          const delta = (weekday - weekdayOfYmd(anchor) + 7) % 7;
          if (delta) anchor = addDaysYmd(anchor, delta);
          store.saveCadence(campaign.id, { id: c?.id || `${campaign.id}-series`, freq: "weeks", interval, weekday, startTime: start, durationMin: length, tz: c?.tz || campaign.tz, anchorDate: anchor, horizonMonths: c?.horizonMonths ?? 4, location: place });
        } else if (!repeat && c) {
          store.saveCadence(campaign.id, null);
        }
        store.flash("Saved.");
        onDone();
      }}
    >
      <div className="fld"><label htmlFor="cn">Name</label><input id="cn" required value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="fld"><label htmlFor="cp">Usual place</label><input id="cp" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="TPK Brewing, back table" /></div>
      <SettingRow title="Usual night" detail="Sessions fill in on their own. Moving or skipping one leaves the rest alone.">
        <Switch on={repeat} label="Usual night" onChange={setRepeat} />
      </SettingRow>
      {repeat && (
        <div className="frow">
          <div className="fld"><label htmlFor="ci">Every</label>
            <select id="ci" value={interval} onChange={(e) => setIntervalN(Number(e.target.value))}>
              <option value={1}>Week</option><option value={2}>Other week</option><option value={3}>3 weeks</option><option value={4}>4 weeks</option>
            </select>
          </div>
          <div className="fld"><label htmlFor="cw">On</label>
            <select id="cw" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="fld"><label htmlFor="cs">Starts</label><input id="cs" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="fld"><label htmlFor="cl">Hours</label>
            <select id="cl" value={length} onChange={(e) => setLength(Number(e.target.value))}>
              {[120, 180, 240, 300, 360].map((m) => <option key={m} value={m}>{m / 60}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="two end">
        <button type="button" className="btn ghost sm" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn pri sm">Save</button>
      </div>
    </form>
  );
}

function roleName(role: Member["role"]): string {
  return role === "organizer" ? "Organizer" : role === "coorganizer" ? "Co-organizer" : "Player";
}

function MemberRow({ m, cid, manage }: { m: Member; cid: string; manage: boolean }) {
  const store = useStore();
  const [menu, setMenu] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(m.characterName || "");
  const mine = m.id === store.state.me.id;
  const primary = m.characterName && m.characterName !== m.displayName ? m.characterName : m.displayName || "Player";
  const secondary = m.characterName && m.characterName !== m.displayName ? m.displayName : "";
  return (
    <li>
      <Avatar name={m.displayName || primary} id={m.id} />
      {naming ? (
        <form className="mi inrow" onSubmit={(e) => { e.preventDefault(); store.patchMember(cid, m.id, { characterName: name.trim() }); setNaming(false); store.flash("Saved."); }}>
          <label className="sr" htmlFor={`cn-${m.id}`}>Character name for {m.displayName || primary}</label>
          <input id={`cn-${m.id}`} size={1} autoFocus value={name} maxLength={60} placeholder="Character name" onChange={(e) => setName(e.target.value)} />
          <button className="btn pri sm" type="submit">Save</button>
          <button className="iconbtn" type="button" aria-label="Cancel" onClick={() => { setNaming(false); setName(m.characterName || ""); }}><Icon name="x" /></button>
        </form>
      ) : (
      <div className="mi">
        <b>{primary}</b>
        {(secondary || mine) && <span className="note">{[secondary, mine ? "you" : ""].filter(Boolean).join(" · ")}</span>}
      </div>
      )}
      {!naming && <span className="rl">{roleName(m.role)}</span>}
      {naming ? null : manage && m.role !== "organizer" ? (
        <div className="mwrap">
          <button className="iconbtn" type="button" aria-label={`Manage ${m.displayName || primary}`} aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((v) => !v)}><Icon name="dots" /></button>
          {menu && (
            <>
              <button className="mscrim" type="button" aria-label="Close" onClick={() => setMenu(false)} />
              <div className="fmenu" role="menu">
                <button role="menuitem" type="button" onClick={() => { setMenu(false); setName(m.characterName || ""); setNaming(true); }}>Character name</button>
                <button role="menuitem" type="button" onClick={() => { setMenu(false); store.patchMember(cid, m.id, { role: m.role === "coorganizer" ? "member" : "coorganizer" }); }}>
                  {m.role === "coorganizer" ? "Make a player" : "Make co-organizer"}
                </button>
                <button role="menuitem" type="button" className="ver" onClick={() => { setMenu(false); if (window.confirm(`Remove ${m.displayName || primary} from this campaign?`)) store.removeMember(cid, m.id); }}>Remove from campaign</button>
              </div>
            </>
          )}
        </div>
      ) : manage ? <span className="iconpad" aria-hidden="true" /> : null}
    </li>
  );
}

function OrganizerPanel({ campaign, members, me }: { campaign: Campaign; members: Member[]; me?: Member }) {
  const store = useStore();
  const router = useRouter();
  const [transfer, setTransfer] = useState(false);
  const [to, setTo] = useState("");
  const [deleting, setDeleting] = useState(false);
  const others = members.filter((m) => m.role !== "organizer");
  const archived = campaign.status === "archived";
  return (
    <>
      <section className="card pad">
        <div className="sh"><h2>Players · {members.length}</h2><Link className="btn sec sm" href={`/invites?campaign=${campaign.id}`}><Icon name="plus" className="ic sm" />Invite</Link></div>
        <ul className="mlist">{members.map((m) => <MemberRow key={m.id} m={m} cid={campaign.id} manage />)}</ul>
        {me && <CharacterField campaign={campaign} me={me} label="Your character name" />}
      </section>
      <section className="card pad">
        <h2 className="ph2">Table rules</h2>
        <SettingRow title="Ask for RSVPs" detail="Off: everyone counts as in until they say otherwise.">
          <Switch on={campaign.requireRsvps} label="Ask for RSVPs" onChange={(v) => store.patchCampaign(campaign.id, { requireRsvps: v })} />
        </SettingRow>
        <SettingRow title="Game's on with" detail="Sessions say when enough players are in to play.">
          <select className="inp qsel" aria-label="Fewest players to play" value={campaign.quorum || 0} onChange={(e) => store.patchCampaign(campaign.id, { quorum: Number(e.target.value) })}>
            <option value={0}>Off</option>
            {Array.from({ length: Math.max(8, members.length) - 1 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n} players</option>)}
          </select>
        </SettingRow>
        <SettingRow title="Players can invite" detail="Anyone at the table can send an invite link.">
          <Switch on={campaign.allowMemberInvites} label="Players can invite" onChange={(v) => store.patchCampaign(campaign.id, { allowMemberInvites: v })} />
        </SettingRow>
      </section>
      <section className="card pad">
        <h2 className="ph2">Organizer</h2>
        <div className="stack2">
          {!transfer ? (
            <button className="btn sec sm full" disabled={others.length === 0} onClick={() => setTransfer(true)}>Transfer to another player</button>
          ) : (
            <div className="tform">
              <div className="fld"><label htmlFor="tt">New organizer</label>
                <select id="tt" value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">Choose a player</option>
                  {others.map((m) => <option key={m.id} value={m.id}>{m.displayName || m.characterName}</option>)}
                </select>
              </div>
              <p className="note">You become a co-organizer.</p>
              <div className="two end">
                <button className="btn ghost sm" type="button" onClick={() => setTransfer(false)}>Cancel</button>
                <button className="btn pri sm" type="button" disabled={!to} onClick={() => { store.transfer(campaign.id, to); setTransfer(false); }}>Transfer</button>
              </div>
            </div>
          )}
          <button className="btn ghost sm full" onClick={() => store.archiveCampaign(campaign.id, !archived)}>{archived ? "Restore campaign" : "Archive campaign"}</button>
          <button className="btn ghost sm full ver" onClick={() => setDeleting(true)}>Delete campaign…</button>
        </div>
      </section>
      {deleting && <DeleteSheet campaign={campaign} onClose={() => setDeleting(false)} onDeleted={() => router.push("/campaigns")} />}
    </>
  );
}

function DeleteSheet({ campaign, onClose, onDeleted }: { campaign: Campaign; onClose: () => void; onDeleted: () => void }) {
  const store = useStore();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const sessions = store.state.sessions.filter((s) => s.cid === campaign.id);
  const recaps = sessions.filter((s) => hasRecap(s)).length;
  const pdfs = sessions.reduce((n, s) => n + sessionFiles(s).length, 0);
  const players = membersOf(store.state, campaign.id).length;
  const match = typed.trim() === campaign.name.trim();
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="del-h">
      <button className="modal-scrim" type="button" aria-label="Close" onClick={onClose} />
      <form className="card sheet" onSubmit={async (e) => {
        e.preventDefault();
        if (!match) return;
        setBusy(true);
        const ok = await store.deleteCampaign(campaign.id);
        setBusy(false);
        if (ok) { store.flash(`${campaign.name} was deleted.`); onDeleted(); }
      }}>
        <h2 id="del-h">Delete {campaign.name}?</h2>
        <p>This permanently removes the campaign for {plural(players, "player")}: {plural(sessions.length, "session")}, {plural(recaps, "recap")}, {plural(pdfs, "PDF")}, its polls and invite links. It can&apos;t be undone.</p>
        <div className="alt">
          <span className="note">Want to keep the history? Archiving hides the campaign and stops reminders.</span>
          <button type="button" className="lnk" onClick={() => { store.archiveCampaign(campaign.id, true); onClose(); }}>Archive instead</button>
        </div>
        <div className="fld"><label htmlFor="del-n">Type the campaign name to confirm</label><input id="del-n" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} /></div>
        <div className="two end">
          <button type="button" className="btn sec sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn sm danger" disabled={!match || busy}>{busy ? "Deleting…" : "Delete forever"}</button>
        </div>
      </form>
    </div>
  );
}

function CharacterField({ campaign, me, label = "Character name" }: { campaign: Campaign; me: Member; label?: string }) {
  const store = useStore();
  const [character, setCharacter] = useState(me.characterName || "");
  useEffect(() => setCharacter(me.characterName || ""), [me.id, me.characterName]);
  const dirty = character.trim() !== (me.characterName || "");
  return (
    <form className="fld" onSubmit={(e) => { e.preventDefault(); store.patchMe(campaign.id, { characterName: character.trim() }); store.flash("Saved."); }}>
      <label htmlFor="ch">{label}</label>
      <div className="inrow">
        <input id="ch" value={character} maxLength={60} onChange={(e) => setCharacter(e.target.value)} placeholder="Who you play" />
        {dirty && <button className="btn pri sm" type="submit">Save</button>}
      </div>
    </form>
  );
}

function PlayerPanel({ campaign, me, members }: { campaign: Campaign; me: Member; members: Member[] }) {
  const store = useStore();
  const router = useRouter();
  const staff = me.role === "coorganizer";
  const canInvite = staff || campaign.allowMemberInvites;
  return (
    <>
      <section className="card pad">
        <h2 className="ph2">You</h2>
        <CharacterField campaign={campaign} me={me} />
        <SettingRow title="Email reminders" detail="3 days and 3 hours before each session.">
          <Switch on={!me.remindersOff} label="Email reminders" onChange={(v) => store.patchMe(campaign.id, { remindersOff: !v })} />
        </SettingRow>
      </section>
      <section className="card pad">
        <div className="sh"><h2>Players · {members.length}</h2>{canInvite && <Link className="btn sec sm" href={`/invites?campaign=${campaign.id}`}><Icon name="plus" className="ic sm" />Invite</Link>}</div>
        <ul className="mlist">{members.map((m) => <MemberRow key={m.id} m={m} cid={campaign.id} manage={false} />)}</ul>
      </section>
      <section className="card pad">
        <button className="btn ghost sm full ver" onClick={async () => {
          if (!window.confirm(`Leave ${campaign.name}? You can rejoin with a new invite.`)) return;
          if (await store.leaveCampaign(campaign.id)) { store.flash(`You left ${campaign.name}.`); router.push("/campaigns"); }
        }}>Leave campaign</button>
      </section>
    </>
  );
}
