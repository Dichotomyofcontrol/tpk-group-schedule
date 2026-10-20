"use client";

import { useEffect, useRef, useState } from "react";
import { markdownToHtml } from "@/lib/recap";
import { sanitizeRecapHtml, stripHtml } from "@/lib/sanitize";
import { useStore } from "@/lib/store";
import type { Session } from "@/lib/types";

export function RecapEditor({ session }: { session: Session }) {
  const store = useStore();
  const startingMarkdown = Boolean(session.recapMarkdown) && !session.recapHtml;
  const [mode, setMode] = useState<"rich" | "markdown">(startingMarkdown ? "markdown" : "rich");
  const [markdown, setMarkdown] = useState(session.recapMarkdown || "");
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(session.recapMarkdown && !session.recapHtml ? "markdown" : "rich");
    setMarkdown(session.recapMarkdown || "");
    if (editorRef.current) editorRef.current.innerHTML = richHtml(session);
  }, [session.id, session.recapHtml, session.recapMarkdown, session.recapText]);

  const format = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const save = () => {
    if (mode === "markdown") {
      const html = sanitizeRecapHtml(markdownToHtml(markdown));
      store.saveRecap(session.id, { recapMarkdown: markdown, recapHtml: html, recapText: stripHtml(html) });
    } else {
      const html = sanitizeRecapHtml(editorRef.current?.innerHTML || "");
      store.saveRecap(session.id, { recapHtml: html, recapText: stripHtml(html), recapMarkdown: "" });
    }
    store.flash("Recap saved.");
  };

  return (
    <div className="recap-editor">
      <div className="toolbar" role="toolbar" aria-label="Recap formatting">
        <button type="button" className={mode === "rich" ? "b p" : "b"} onClick={() => setMode("rich")}>Rich text</button>
        <button type="button" className={mode === "markdown" ? "b p" : "b"} onClick={() => setMode("markdown")}>Markdown</button>
        {mode === "rich" && (
          <>
            <button type="button" className="b" aria-label="Bold" onClick={() => format("bold")}><b>B</b></button>
            <button type="button" className="b" aria-label="Italic" onClick={() => format("italic")}><i>I</i></button>
            <button type="button" className="b" onClick={() => format("formatBlock", "h2")}>Heading</button>
            <button type="button" className="b" onClick={() => format("formatBlock", "blockquote")}>Quote</button>
            <button type="button" className="b" aria-label="Bulleted list" onClick={() => format("insertUnorderedList")}>List</button>
            <button type="button" className="b" aria-label="Numbered list" onClick={() => format("insertOrderedList")}>1.</button>
          </>
        )}
      </div>
      {mode === "rich" ? (
        <div
          ref={editorRef}
          className="editor reader"
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Recap"
          data-placeholder="What happened last time…"
          suppressContentEditableWarning
        />
      ) : (
        <>
          <textarea
            className="editor"
            rows={10}
            aria-label="Recap markdown"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            placeholder={"## The Wizard of Wines\n\nThe vineyard **burned**."}
          />
          <p className="tz">Preview</p>
          <div className="reader preview" dangerouslySetInnerHTML={{ __html: sanitizeRecapHtml(markdownToHtml(markdown)) }} />
        </>
      )}
      <p className="tz">Rich text keeps notes already written on the current site. Markdown is another way to write. Saving the latest recap also refreshes Previously on.</p>
      <button type="button" className="b p" onClick={save}>Save recap</button>
    </div>
  );
}

function richHtml(session: Session): string {
  if (session.recapHtml) return sanitizeRecapHtml(session.recapHtml);
  if (session.recapMarkdown) return sanitizeRecapHtml(markdownToHtml(session.recapMarkdown));
  if (session.recapText) return `<p>${session.recapText.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`;
  return "";
}
