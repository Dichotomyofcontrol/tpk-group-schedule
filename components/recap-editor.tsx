"use client";

import { useEffect, useRef } from "react";
import { markdownToHtml } from "@/lib/recap";
import { sanitizeRecapHtml, stripHtml } from "@/lib/sanitize";
import { useStore } from "@/lib/store";
import type { Session } from "@/lib/types";

/** One editor. Paste from your notes; bold, italics and lists come along. */
export function RecapEditor({ session, onSaved }: { session: Session; onSaved?: () => void }) {
  const store = useStore();
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = startingHtml(session);
    editorRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const save = () => {
    const html = sanitizeRecapHtml(editorRef.current?.innerHTML || "");
    store.saveRecap(session.id, { recapHtml: html, recapText: stripHtml(html), recapMarkdown: "" });
    store.flash("Recap saved.");
    onSaved?.();
  };

  return (
    <div className="recap-editor">
      <div
        ref={editorRef}
        className="editor reader"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Recap"
        data-placeholder="What happened this session…"
        suppressContentEditableWarning
      />
      <div className="two end">
        <button type="button" className="btn ghost sm" onClick={() => onSaved?.()}>Cancel</button>
        <button type="button" className="btn pri sm" onClick={save}>Save recap</button>
      </div>
    </div>
  );
}

function startingHtml(session: Session): string {
  if (session.recapHtml) return sanitizeRecapHtml(session.recapHtml);
  if (session.recapMarkdown) return sanitizeRecapHtml(markdownToHtml(session.recapMarkdown));
  if (session.recapText) return `<p>${session.recapText.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`;
  return "";
}
