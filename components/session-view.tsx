"use client";

import Link from "next/link";
import { useState } from "react";
import { attendanceState, headcountLabel, isGreyed } from "@/lib/attendance";
import { coverArt } from "@/lib/covers";
import { googleEventTemplate } from "@/lib/ics";
import { isStaff, membersOf, snackName } from "@/lib/model";
import { hasRecap, markdownToHtml, validatePdf } from "@/lib/recap";
import { sanitizeRecapHtml } from "@/lib/sanitize";
import { useStore } from "@/lib/store";
import { formatDayHeading, formatRangePretty } from "@/lib/time";
import { EmptyState } from "./empty-state";
import { Face, Stack } from "./faces";
import { PdfPreview } from "./pdf-preview";
import { RecapEditor } from "./recap-editor";

export function SessionView({ cid, sid }: { cid: string; sid: string }) {
  const store = useStore();
  const campaign = store.state.campaigns.find((item) => item.id === cid);
  const member = (store.state.members[cid] || []).find((item) => item.id === store.state.me.id);
  const session = store.state.sessions.find((item) => item.id === sid && item.cid === cid);
  if (!campaign || !member) {
    return (
      <>
        <div className="mh"><h1>Session</h1></div>
        <EmptyState
          title={store.state.me.id ? "You're not at this table" : "Sign in to open this session"}
          action={store.state.me.id ? <Link className="b" href="/">Play dates</Link> : <Link className="b p" href="/signin">Sign in</Link>}
        >
          Recaps stay with the campaign. Open an invite if you were asked to join.
        </EmptyState>
      </>
    );
  }
  if (!session) {
    return (
      <div className="card">
        <h1>That session is gone</h1>
        <Link className="b" href={`/campaigns/${cid}`}>Back to {campaign.name}</Link>
      </div>
    );
  }
  const members = membersOf(store.state, cid);
  const grey = new Set(members.filter((item) => isGreyed(campaign, session, item.id)).map((item) => item.id));
  const staff = isStaff(store.state, cid);
  const html = session.recapHtml || (session.recapMarkdown ? markdownToHtml(session.recapMarkdown) : "");
  const when = formatDayHeading(session.startsAt, session.tz);
  const [editing, setEditing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const mine = attendanceState(campaign, session, store.state.me.id);
  const snack = snackName(store.state, session);
  const titleParts = session.title.split(" · ");
  const sessionLabel = titleParts.length > 1 ? titleParts[0] : "";
  const headline = titleParts.length > 1 ? titleParts.slice(1).join(" · ") : session.title;
  const later = store.state.sessions
    .filter((item) => item.cid === cid && item.status === "scheduled" && item.startsAt > session.startsAt)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const add = googleEventTemplate(session, campaign);

  return (
    <>
      <Link className="back" href="/">← All play dates</Link>
      <section className="banner" style={{ ["--c" as string]: campaign.color, ["--img" as string]: `url(${coverArt(campaign.cover.src)})` }}>
        <div className="art" role="img" aria-label={campaign.cover.credit || campaign.name} />
        <div className="tx">
          <div className="kick">
            <Link href={`/campaigns/${cid}`}>{campaign.name}</Link>
            {sessionLabel ? ` · ${sessionLabel}` : ""}
          </div>
          <h1>{headline}</h1>
          <div className="tile" aria-hidden="true"><small>{when.dow}</small><b>{when.day}</b><small>{when.mon}</small></div>
          <p className="big" style={{ margin: "8px 0 0" }}>{formatRangePretty(session.startsAt, session.endsAt, session.tz)}</p>
          <p style={{ margin: "6px 0 0" }}>
            {session.location}
            {session.status === "cancelled" ? " · Skipped" : ""}
            {snack ? ` · Snacks: ${snack}` : ""}
          </p>
          <div className="actions" style={{ marginTop: 12 }}>
            <span className={`chip${mine === "out" ? " n" : " y"}`}>{mine === "out" ? "You're out" : "You're in"}</span>
            <button className="b p" type="button" onClick={() => store.mark(session.id, store.state.me.id, mine === "out" ? "in" : "out")}>
              {mine === "out" ? "I can make it" : "Can't make it"}
            </button>
            <a className="b" href={add}>Add to calendar</a>
          </div>
        </div>
      </section>
      <div className="two">
        <div className="card party">
          <h3 style={{ marginTop: 0 }}>The party <em>{headcountLabel(campaign, session, members)}</em></h3>
          <Stack members={members} grey={grey} color={campaign.color} />
          <ul>
            {members.map((person) => {
              const out = grey.has(person.id);
              const name = person.characterName || person.displayName;
              const player = person.characterName && person.characterName !== person.displayName ? person.displayName : "";
              const dm = person.tags?.includes("dm") ? "DM" : "";
              const subtitle = [player, dm].filter(Boolean).join(" · ");
              return (
                <li className="mem" key={person.id}>
                  <Face hue={person.hue} name={name} out={out} size={40} />
                  <div>
                    <b>{name}</b>
                    {subtitle && <div className="tz">{subtitle}</div>}
                  </div>
                  <span className={out ? "chip n" : "chip y"}>{out ? "Can't make it" : "In"}</span>
                </li>
              );
            })}
          </ul>
          <p className="fine">Everyone&apos;s in by default. Tap &quot;Can&apos;t make it&quot; if you can&apos;t.</p>
        </div>
        <article className="card notes">
          <h3 style={{ marginTop: 0 }}>Session notes</h3>
          {campaign.previouslyOn && (
            <blockquote className="prev">
              <q>{campaign.previouslyOn}</q>
              <cite>Recap{campaign.previouslyOnSessionId ? ` · earlier session` : ""}</cite>
            </blockquote>
          )}
          <dl>
            {session.notes && (<><dt>Bring</dt><dd>{session.notes}</dd></>)}
            {snack && (<><dt>Snacks</dt><dd>{snack}</dd></>)}
            {later && (
              <>
                <dt>Next after this</dt>
                <dd><Link href={`/campaigns/${cid}/sessions/${later.id}`}>{formatRangePretty(later.startsAt, later.endsAt, later.tz).replace(/ · .*$/, "")} · {later.title}</Link></dd>
              </>
            )}
          </dl>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 8 }}>
            <b>Recap</b>
            {staff && (
              <button className="b" type="button" onClick={() => setEditing((open) => !open)}>
                {editing ? "Close editor" : hasRecap(session) ? "Edit recap" : "Write recap"}
              </button>
            )}
          </div>
          {html ? (
            <div className="reader" dangerouslySetInnerHTML={{ __html: sanitizeRecapHtml(html) }} />
          ) : (
            <p className="tz">{staff ? "Nothing written yet." : "No written recap for this night yet."}</p>
          )}
          {editing && staff && <RecapEditor session={session} />}
          {(session.pdfPath || session.pdfName || session.pdfUrl || session.extraPdfs?.length || staff) && (
            <div style={{ marginTop: 12 }}>
              <b>PDF</b>
              {(session.pdfPath || session.pdfName || session.pdfUrl) ? <PdfPreview session={session} /> : !session.extraPdfs?.length && <p className="tz">No PDF attached.</p>}
              {session.extraPdfs?.map((file) => <PdfPreview key={file.path} session={session} file={file} />)}
              {staff && (
                <div className="field">
                  <label htmlFor="recap-pdf">Upload a PDF, 25 MB max</label>
                  <input
                    id="recap-pdf"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      const problem = validatePdf(file);
                      if (problem) {
                        setFileError(problem);
                        return;
                      }
                      setFileError(null);
                      void store.attachPdf(session.id, file);
                    }}
                  />
                  {fileError && <p className="tz" role="alert">{fileError}</p>}
                  {session.pdfPath && (
                    <button className="b" type="button" onClick={() => store.clearPdf(session.id)}>Remove PDF</button>
                  )}
                </div>
              )}
            </div>
          )}
        </article>
      </div>
    </>
  );
}
