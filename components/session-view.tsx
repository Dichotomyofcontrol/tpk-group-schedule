"use client";

import Link from "next/link";
import { useState } from "react";
import { headcountLabel, isGreyed } from "@/lib/attendance";
import { isStaff, membersOf } from "@/lib/model";
import { hasRecap, markdownToHtml, validatePdf } from "@/lib/recap";
import { sanitizeRecapHtml } from "@/lib/sanitize";
import { useStore } from "@/lib/store";
import { formatDayHeading, formatRangePretty } from "@/lib/time";
import { Stack } from "./faces";
import { PdfPreview } from "./pdf-preview";
import { RecapEditor } from "./recap-editor";

export function SessionView({ cid, sid }: { cid: string; sid: string }) {
  const store = useStore();
  const campaign = store.state.campaigns.find((item) => item.id === cid);
  const member = (store.state.members[cid] || []).find((item) => item.id === store.state.me.id);
  const session = store.state.sessions.find((item) => item.id === sid && item.cid === cid);
  if (!campaign || !member) {
    return (
      <div className="card">
        <h1>You&apos;re not at this table</h1>
        <p>Recaps stay with the campaign. Open an invite if you were asked to join.</p>
        <Link className="b" href="/">Back to play dates</Link>
      </div>
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

  return (
    <>
      <section className="banner" style={{ ["--c" as string]: campaign.color, ["--img" as string]: `url(${campaign.cover.src})` }}>
        <div className="art" role="img" aria-label={campaign.cover.credit || campaign.name} />
        <div className="tx">
          <small>
            <Link href={`/campaigns/${cid}`}>{campaign.icon} {campaign.name}</Link>
            {" · "}
            {formatRangePretty(session.startsAt, session.endsAt, session.tz)}
          </small>
          <h1>{session.title}</h1>
          <div className="tile" aria-hidden="true"><small>{when.dow}</small><b>{when.day}</b><small>{when.mon}</small></div>
          <p style={{ margin: "6px 0 0" }}>{session.location}{session.status === "cancelled" ? " · Skipped" : ""}</p>
        </div>
      </section>
      <div className="two">
        <div>
          <article className="card" style={{ ["--c" as string]: campaign.color }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
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
              <p className="tz">{staff ? "Nothing written yet. The notes from the current site land here after migration." : "No written recap for this night yet."}</p>
            )}
            {editing && staff && <RecapEditor session={session} />}
          </article>
          <article className="card">
            <b>PDF</b>
            <p className="tz">The same file the current site stores for this session. Only people in the campaign can open it.</p>
            {(session.pdfPath || session.pdfName || session.pdfUrl) ? <PdfPreview session={session} /> : <p>No PDF attached.</p>}
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
          </article>
        </div>
        <div>
          <div className="card">
            <Stack members={members} grey={grey} color={campaign.color} />
            <p className="hc">{headcountLabel(campaign, session, members)}</p>
            <p className="tz">{session.tz}</p>
            <Link className="b" href={`/campaigns/${cid}`}>All {campaign.name} nights</Link>
          </div>
        </div>
      </div>
    </>
  );
}
