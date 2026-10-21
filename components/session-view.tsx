"use client";

import Link from "next/link";
import { useState } from "react";
import { headcountLabel, isGreyed } from "@/lib/attendance";
import { isStaff, membersOf } from "@/lib/model";
import { hasRecap, markdownToHtml, validatePdf } from "@/lib/recap";
import { sanitizeRecapHtml } from "@/lib/sanitize";
import { useStore } from "@/lib/store";
import { formatDayHeading, formatRangePretty } from "@/lib/time";
import { coverSrc } from "@/lib/covers";
import { PdfPreview } from "./pdf-preview";
import { RecapEditor } from "./recap-editor";
import { Avatar, Icon } from "./ui";

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
      <p className="note" style={{ marginBottom: 12 }}><Link href={`/campaigns/${cid}`}>{campaign.name}</Link> · {formatRangePretty(session.startsAt, session.endsAt, session.tz)}</p>
      <div className="ptitle">
        <div>
          <div className="eyebrow">{when.dow} {when.mon} {when.day}{session.status === "cancelled" ? " · Skipped" : ""}</div>
          <h1 className="lt">{session.title}</h1>
        </div>
      </div>
      <div className="card next" style={{ marginBottom: 24 }}>
        <div className="cover" style={{ height: 200 }}>
          <img className="art" src={coverSrc(campaign.cover.src, campaign.id)} alt="" />
          <div className="ctop"><div className="eyebrow">{session.location}</div><h2>{campaign.name}</h2></div>
        </div>
        <div className="nb">
          <div className="party">
            {members.map((m) => (
              <span key={m.id} className={grey.has(m.id) ? "pp out" : "pp"}>
                <Avatar name={m.displayName} id={m.id} /><span>{m.displayName.split(" ")[0]}</span>
              </span>
            ))}
          </div>
          <span className={grey.size ? "status warn" : "status"}>{headcountLabel(campaign, session, members)}</span>
        </div>
      </div>
      <article className="card recap">
        {(session.pdfName || session.pdfPath) && <span className="ribbon gold" />}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div className="eyebrow">Recap</div>
          {staff && (
            <button className="btn ghost sm" type="button" onClick={() => setEditing((open) => !open)}>
              <Icon name="quill" className="ic sm" />{editing ? "Close" : hasRecap(session) ? "Edit" : "Write"}
            </button>
          )}
        </div>
        {html ? (
          <div className="body"><div className="reader" dangerouslySetInnerHTML={{ __html: sanitizeRecapHtml(html) }} /></div>
        ) : (
          <p className="note">{staff ? "Nothing written yet. Paste the recap or attach the PDF." : "No written recap for this night yet."}</p>
        )}
        {editing && staff && <RecapEditor session={session} />}
        {(session.pdfPath || session.pdfName || session.pdfUrl) && (
          <div className="pdf">
            <span className="pi">PDF</span>
            <div><b>{session.pdfName || "Session PDF"}</b><span className="note">Only people at this table can open it.</span></div>
          </div>
        )}
        <PdfPreview session={session} />
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
            {fileError && <p className="note" role="alert">{fileError}</p>}
            {session.pdfPath && <button className="btn sec sm" type="button" onClick={() => store.clearPdf(session.id)}>Remove PDF</button>}
          </div>
        )}
      </article>
    </>
  );
}
