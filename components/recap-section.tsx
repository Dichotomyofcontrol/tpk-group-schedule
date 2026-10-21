"use client";

import { useRef, useState } from "react";
import { isStaff, sessionFiles , sessionTitle } from "@/lib/model";
import { hasRecap, markdownToHtml, validatePdf } from "@/lib/recap";
import { sanitizeRecapHtml } from "@/lib/sanitize";
import { useStore } from "@/lib/store";
import type { Session, SessionFile } from "@/lib/types";
import { RecapEditor } from "./recap-editor";
import { Icon } from "./ui";

type Pending = { id: number; name: string; progress: number; error?: string };

/** "12 pages · 2.4 MB", either part only when known, or "" when nothing is. The icon already says PDF. */
function fileMeta(file: { size?: number; pages?: number }): string {
  const parts: string[] = [];
  if (file.pages) parts.push(`${file.pages} ${file.pages === 1 ? "page" : "pages"}`);
  if (file.size) parts.push(file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1048576).toFixed(1)} MB`);
  return parts.join(" · ");
}

/** Recap text, then one clean row per PDF, then a single Add a PDF. */
export function RecapSection({ session }: { session: Session }) {
  const store = useStore();
  const staff = isStaff(store.state, session.cid);
  const html = session.recapHtml || (session.recapMarkdown ? markdownToHtml(session.recapMarkdown) : session.recapText ? `<p>${session.recapText.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "");
  const files = sessionFiles(session);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const nextId = useRef(1);

  const pick = (replacing: string | null) => {
    replaceTarget.current = replacing;
    input.current?.click();
  };

  const upload = async (file: File) => {
    const id = nextId.current++;
    const replacing = replaceTarget.current;
    replaceTarget.current = null;
    const problem = validatePdf(file);
    if (problem) {
      setPending((list) => [...list, { id, name: file.name, progress: 0, error: problem }]);
      return;
    }
    setPending((list) => [...list, { id, name: file.name, progress: 0 }]);
    const onProgress = (f: number) => setPending((list) => list.map((p) => (p.id === id ? { ...p, progress: f } : p)));
    const error = replacing
      ? await store.replacePdf(session.id, replacing, file, onProgress)
      : await store.attachPdf(session.id, file, onProgress);
    if (error) setPending((list) => list.map((p) => (p.id === id ? { ...p, error } : p)));
    else setPending((list) => list.filter((p) => p.id !== id));
  };

  const empty = !html && files.length === 0;

  return (
    <section className="card recap" aria-labelledby="recap-h">
      {files.length > 0 && <span className="ribbon gold" aria-hidden="true" />}
      <div className="sh">
        <h2 id="recap-h">Recap</h2>
        {staff && !empty && (
          <button className="btn ghost sm" type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            <Icon name="quill" className="ic sm" />{editing ? "Done" : html ? "Edit" : "Write"}
          </button>
        )}
      </div>
      {editing && staff ? (
        <RecapEditor session={session} onSaved={() => setEditing(false)} />
      ) : html ? (
        <div className="reader" dangerouslySetInnerHTML={{ __html: dropTitle(sanitizeRecapHtml(html), sessionTitle(store.state, session)) }} />
      ) : empty ? (
        <div className="empty">
          <p>{staff ? "Nothing yet for this night." : "No recap for this night yet."}</p>
          {staff && (
            <>
              <div className="two">
                <button className="btn pri sm" type="button" onClick={() => setEditing(true)}><Icon name="quill" className="ic sm" />Write recap</button>
                <button className="btn sec sm" type="button" onClick={() => pick(null)}><Icon name="upload" className="ic sm" />Add a PDF</button>
              </div>
              <p className="note">Paste from your notes, or attach the PDF. One is enough.</p>
            </>
          )}
        </div>
      ) : null}

      {(files.length > 0 || pending.length > 0) && (
        <>
          <h3 className="fh">Files</h3>
          {files.map((file) => <FileRow key={file.path} session={session} file={file} staff={staff} onReplace={() => pick(file.path)} />)}
          {pending.map((p) => (
            <div key={p.id} className={p.error ? "file err" : "file"} role={p.error ? "alert" : undefined}>
              <span className="ficon">PDF</span>
              <div className="fm">
                <b>{p.name}</b>
                {p.error ? <span className="note ver">{p.error}</span> : <span className="pbar" aria-label={`Uploading ${Math.round(p.progress * 100)}%`}><i style={{ width: `${Math.max(4, p.progress * 100)}%` }} /></span>}
              </div>
              {p.error && <button className="iconbtn" type="button" aria-label="Dismiss" onClick={() => setPending((list) => list.filter((x) => x.id !== p.id))}><Icon name="x" /></button>}
            </div>
          ))}
        </>
      )}
      {staff && !(empty && !editing) && (
        <button type="button" className="addfile" onClick={() => pick(null)}>
          <Icon name="upload" className="ic sm" /><span>Add a PDF</span><span className="note">up to 25 MB</span>
        </button>
      )}
      {staff && (
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      )}
    </section>
  );
}

function FileRow({ session, file, staff, onReplace }: { session: Session; file: SessionFile; staff: boolean; onReplace: () => void }) {
  const store = useStore();
  const [menu, setMenu] = useState(false);
  const [up, setUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async (download: boolean) => {
    setMenu(false);
    setError(null);
    // Open the tab inside the click so popup blockers allow it, then point it at the signed URL.
    const tab = download ? null : window.open("about:blank", "_blank");
    setBusy(true);
    const url = await store.fileUrl(session.id, file.path, download);
    setBusy(false);
    if (!url) {
      tab?.close();
      setError("Couldn't open this file. Try again in a moment.");
      return;
    }
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
  };

  return (
    <div className="file">
      <span className="ficon">PDF</span>
      <div className="fm">
        <b>{file.name}</b>
        {error ? <span className="note ver" role="alert">{error}</span> : fileMeta(file) ? <span className="note">{fileMeta(file)}</span> : null}
      </div>
      <button className="btn sec sm fopen" type="button" onClick={() => void open(false)} disabled={busy}>
        <Icon name="ext" className="ic sm" />{busy ? "Opening…" : "Open"}
      </button>
      <div className="mwrap">
        <button className="iconbtn" type="button" aria-label={`More for ${file.name}`} aria-expanded={menu} aria-haspopup="menu" onClick={(e) => { setUp(e.currentTarget.getBoundingClientRect().bottom > window.innerHeight - 240); setMenu((v) => !v); }}>
          <Icon name="dots" />
        </button>
        {menu && (
          <>
            <button className="mscrim" aria-label="Close" type="button" onClick={() => setMenu(false)} />
            <div className={up ? "fmenu up" : "fmenu"} role="menu">
              <button role="menuitem" type="button" onClick={() => void open(true)}><Icon name="down" className="ic sm" />Download</button>
              {staff && <button role="menuitem" type="button" onClick={() => { setMenu(false); onReplace(); }}><Icon name="upload" className="ic sm" />Replace</button>}
              {staff && (
                <button role="menuitem" type="button" className="ver" onClick={() => {
                  setMenu(false);
                  if (window.confirm(`Remove ${file.name} from this recap?`)) void store.removePdf(session.id, file.path);
                }}><Icon name="x" className="ic sm" />Remove</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The page already shows the session title, so drop a recap that opens by repeating it. */
function dropTitle(html: string, title?: string): string {
  if (!title) return html;
  const m = html.match(/^\s*<(h[1-4])[^>]*>([\s\S]*?)<\/\1>/i);
  if (!m) return html;
  const text = m[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim().toLowerCase();
  return text === title.trim().toLowerCase() ? html.slice(m[0].length) : html;
}
