"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { memberCampaigns } from "@/lib/model";
import { useStore } from "@/lib/store";
import { Avatar, Brand, Icon, type IconName } from "./ui";

const TABS: { id: string; href: string; label: string; icon: IconName }[] = [
  { id: "home", href: "/", label: "Play dates", icon: "dates" },
  { id: "campaigns", href: "/campaigns", label: "Campaigns", icon: "camp" },
  { id: "polls", href: "/polls", label: "Polls", icon: "polls" },
  { id: "invites", href: "/invites", label: "Invites", icon: "inv" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const { state } = store;
  const path = usePathname();
  const params = useSearchParams();
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [panel, setPanel] = useState<"profile" | "calendar" | "mail" | null>(null);
  const [origin, setOrigin] = useState("");
  const signedIn = Boolean(state.me.id);
  const landing = !signedIn && path === "/";

  useLayoutEffect(() => {
    const as = params.get("as");
    if (as && store.mode === "demo") store.setPersona(as);
    document.body.dataset.persona = state.me.id || "guest";
    document.body.dataset.ready = "1";
  }, [params, store, state.me.id]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "?") setHelp(true);
      if (event.key === "Escape") { setHelp(false); setMenu(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const mine = memberCampaigns(state);
  const openPolls = state.polls.filter((p) => p.status === "open" && mine.some((c) => c.id === p.cid)).length;
  const tab = path.startsWith("/campaigns") ? "campaigns" : path.startsWith("/polls") ? "polls" : path.startsWith("/invite") ? "invites" : "home";
  const campaignHero = /^\/campaigns\/[^/]+$/.test(path);
  const bare = path === "/signin" || path.startsWith("/auth/");
  const feed = state.me.calToken ? `${origin}/api/cal/${state.me.calToken}.ics?hide=${state.hiddenCids.join(",")}` : "";
  const webcal = feed.replace(/^https?:/, "webcal:");
  const night = store.resolvedTheme === "dark";

  return (
    <>
      {!store.online && <div className="offline">You&apos;re offline. Showing your last-synced schedule.</div>}
      <header className={landing ? "hdr clear" : "hdr"}>
        <Brand />
        {signedIn && !bare && (
          <>
            <span className="sp" />
            <nav className="dnav" aria-label="Primary">
              {TABS.map((item) => (
                <Link key={item.id} href={item.href} className={tab === item.id ? "on" : ""}>
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </nav>
            <button className="acct" aria-label={`Account menu: ${state.me.displayName}`} aria-expanded={menu} onClick={() => { setMenu((v) => !v); setPanel(null); }}>
              <Avatar name={state.me.displayName} id={state.me.id} />
              <Icon name="chev" className="ic ch" />
            </button>
          </>
        )}
      </header>
      {landing || bare ? children : <main className={campaignHero ? "cm" : ""}>{children}</main>}
      {signedIn && !bare && (
        <nav className="tabs" aria-label="Primary">
          {TABS.map((item) => (
            <Link key={item.id} href={item.href} className={tab === item.id ? "on" : ""} aria-current={tab === item.id ? "page" : undefined}>
              <Icon name={item.icon} />
              {item.label}
              {item.id === "polls" && openPolls > 0 && <span className="badge">{openPolls}</span>}
            </Link>
          ))}
        </nav>
      )}
      {menu && signedIn && (
        <div id="menu">
          <button className="scrim" aria-label="Close" onClick={() => setMenu(false)} />
          <div className="pop" role="menu">
            <div className="me">
              <Avatar name={state.me.displayName} id={state.me.id} className="" />
              <div>
                <b>{state.me.displayName}</b>
                <span>{state.me.email}</span>
              </div>
            </div>
            {store.mode === "demo" && (
              <div className="panel">
                <label htmlFor="persona">View the sample as</label>
                <select id="persona" className="inp" value={state.me.id || "guest"} onChange={(e) => store.setPersona(e.target.value)}>
                  <option value="guest">Signed out</option>
                  {state.directory.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
                </select>
              </div>
            )}
            <hr className="hair" />
            <button className="item" onClick={() => setPanel(panel === "profile" ? null : "profile")}><Icon name="shield" />Profile &amp; characters</button>
            {panel === "profile" && (
              <div className="panel">
                {mine.map((c) => {
                  const member = (state.members[c.id] || []).find((m) => m.id === state.me.id);
                  return <div key={c.id}><b>{member?.characterName || state.me.displayName}</b><div className="note">{c.name}{member?.role === "organizer" ? " · GM" : ""}</div></div>;
                })}
                {mine.length === 0 && <p className="note">You&apos;re not at a table yet.</p>}
              </div>
            )}
            <button className="item" onClick={() => setPanel(panel === "calendar" ? null : "calendar")}><Icon name="link" />Calendar subscription</button>
            {panel === "calendar" && (
              <div className="panel">
                <p className="note">Only play dates, for the campaigns you haven&apos;t hidden.</p>
                <a className="btn sec sm" href={webcal}>Apple / Outlook</a>
                <a className="btn sec sm" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}>Google Calendar</a>
                <button className="btn ghost sm" onClick={() => void navigator.clipboard.writeText(webcal || feed)}>Copy link</button>
              </div>
            )}
            <button className="item" onClick={() => setPanel(panel === "mail" ? null : "mail")}><Icon name="inv" />Notification emails</button>
            {panel === "mail" && <div className="panel"><p className="note">Session reminders go to {state.me.email || "the email you signed in with"}.</p></div>}
            <button className="item" role="menuitemcheckbox" aria-checked={night} onClick={() => store.setTheme(night ? "light" : "dark")}>
              <Icon name="moon" />Night theme<span className="tog" />
            </button>
            <hr className="hair" />
            <button className="item out" onClick={() => { setMenu(false); void store.signOut(); }}>Sign out</button>
          </div>
        </div>
      )}
      {help && (
        <div className="toasts" style={{ bottom: "auto", top: 80 }}>
          <div className="card help" role="dialog" aria-label="Keyboard shortcuts">
            <b>Shortcuts</b>
            <p><kbd>j</kbd> <kbd>k</kbd> move through play dates</p>
            <p><kbd>c</kbd> can&apos;t make it, or come back</p>
            <p><kbd>?</kbd> this card · <kbd>esc</kbd> close</p>
            <button className="btn sec sm" onClick={() => setHelp(false)}>Close</button>
          </div>
        </div>
      )}
      <div className="toasts" aria-live="polite">
        {store.toasts.map((t) => (
          <div key={t.id} className={`toast${t.tone === "err" ? " err" : ""}`}>
            <span>{t.text}</span>
            <button className="btn sec sm" onClick={() => store.dismissToast(t.id)}>OK</button>
          </div>
        ))}
      </div>
    </>
  );
}
