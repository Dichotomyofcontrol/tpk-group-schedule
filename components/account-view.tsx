"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { BackBar, SettingRow, Switch } from "./ui";

export function AccountView() {
  const store = useStore();
  const { state } = store;
  const [name, setName] = useState(state.me.displayName);
  useEffect(() => setName(state.me.displayName), [state.me.id, state.me.displayName]);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => { setName(state.me.displayName); }, [state.me.displayName]);
  if (!state.me.id) return null;
  const feed = state.me.calToken ? `${origin}/api/cal/${state.me.calToken}.ics` : "";
  const webcal = feed.replace(/^https?:/, "webcal:");
  const night = store.resolvedTheme === "dark";
  const dirty = name.trim() !== state.me.displayName && name.trim().length > 0;
  return (
    <div className="narrow">
      <BackBar href="/sessions" label="Sessions" />
      <p className="kicker">You</p>
      <h1 className="lt">Account</h1>
      <p className="sub">Signed in as {state.me.email}</p>
      <form className="card pad" onSubmit={async (e) => { e.preventDefault(); await store.setDisplayName(name); store.flash("Name saved."); }}>
        <div className="fld">
          <label htmlFor="dn">Display name</label>
          <input id="dn" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
          <span className="note">What your table sees on sessions and RSVPs. Character names are set per campaign.</span>
        </div>
        <div className="two end"><button className="btn pri sm" type="submit" disabled={!dirty}>Save</button></div>
      </form>
      <section className="card pad">
        <h2 className="ph2">Calendar</h2>
        <p className="note gap">Every session from your campaigns, kept up to date.</p>
        {feed ? (
          <div className="two">
            <a className="btn sec sm" href={webcal}>Apple / Outlook</a>
            <a className="btn sec sm" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">Google</a>
            <button className="btn ghost sm" type="button" onClick={() => { void navigator.clipboard.writeText(webcal).then(() => setCopied(true)); }}>{copied ? "Copied" : "Copy link"}</button>
          </div>
        ) : <p className="note">Your calendar link appears after your first sign-in finishes.</p>}
      </section>
      <section className="card pad">
        <SettingRow title="Night theme" detail="Cream is the default.">
          <Switch on={night} label="Night theme" onChange={(v) => store.setTheme(v ? "dark" : "light")} />
        </SettingRow>
      </section>
      <section className="card pad">
        <button className="btn ghost sm full ver" type="button" onClick={() => void store.signOut()}>Sign out</button>
      </section>
    </div>
  );
}
