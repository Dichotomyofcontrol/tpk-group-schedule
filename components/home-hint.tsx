"use client";

import { useEffect, useState } from "react";
import { Icon } from "./ui";

/** iPhone/iPad Safari only, not already installed: a one-time hint to add the app to the Home Screen. */
export function HomeScreenHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone || window.matchMedia("(display-mode: standalone)").matches;
    const seen = Number(window.localStorage.getItem("tpk-visits") || "0") + 1;
    window.localStorage.setItem("tpk-visits", String(seen));
    // Second visit onward, so a first-time invitee isn't greeted by a prompt.
    setShow(ios && !standalone && seen >= 2 && !window.localStorage.getItem("tpk-a2hs-dismissed"));
  }, []);
  if (!show) return null;
  return (
    <div className="card a2hs" role="note">
      <span className="fi"><Icon name="plus" /></span>
      <p><b>Put Six in the TPK on your Home Screen.</b> Tap <ShareGlyph /> Share, then <i>Add to Home Screen</i>.</p>
      <button type="button" className="iconbtn" aria-label="Dismiss" onClick={() => { window.localStorage.setItem("tpk-a2hs-dismissed", "1"); setShow(false); }}><Icon name="x" /></button>
    </div>
  );
}

function ShareGlyph() {
  return (
    <svg className="sg" width="14" height="16" viewBox="0 0 14 16" aria-label="Share icon" role="img">
      <path d="M7 1v9M3.5 4.5L7 1l3.5 3.5M2 7.5H1.5A.5.5 0 0 0 1 8v6.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V8a.5.5 0 0 0-.5-.5H12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
