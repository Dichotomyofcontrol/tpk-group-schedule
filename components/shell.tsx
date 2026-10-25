"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { memberCampaigns } from "@/lib/model";
import { useStore } from "@/lib/store";
import type { Toast } from "@/lib/types";
import { Avatar, Brand, Icon, type IconName } from "./ui";

const TABS: { id: string; href: string; label: string; icon: IconName }[] = [
  { id: "sessions", href: "/sessions", label: "Sessions", icon: "dates" },
  { id: "campaigns", href: "/campaigns", label: "Campaigns", icon: "camp" },
  { id: "polls", href: "/polls", label: "Polls", icon: "polls" },
  { id: "invites", href: "/invites", label: "Invites", icon: "inv" },
];

/** Keep a dismissed toast on screen for its exit spring, then drop it. Reduced motion: gone at once. */
const TOAST_OUT_MS = 220;
function useLeavingToasts(toasts: Toast[]) {
  const [leaving, setLeaving] = useState<Toast[]>([]);
  const prev = useRef<Toast[]>(toasts);
  useEffect(() => {
    const gone = prev.current.filter((p) => !toasts.some((t) => t.id === p.id));
    prev.current = toasts;
    if (!gone.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLeaving((list) => [...list, ...gone]);
    const ids = gone.map((g) => g.id);
    window.setTimeout(() => setLeaving((list) => list.filter((t) => !ids.includes(t.id))), TOAST_OUT_MS);
  }, [toasts]);
  return [...toasts.map((t) => ({ t, leaving: false })), ...leaving.filter((l) => !toasts.some((t) => t.id === l.id)).map((t) => ({ t, leaving: true }))].sort((a, b) => a.t.id - b.t.id);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const shown = useLeavingToasts(store.toasts);
  const { state } = store;
  const path = usePathname();
  const params = useSearchParams();
  const [menu, setMenu] = useState(false);
  const [keys, setKeys] = useState(false);
  const signedIn = Boolean(state.me.id);
  const landing = !signedIn && path === "/";
  const first = useRef(true);
  const router = useRouter();
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;

  useLayoutEffect(() => {
    const as = params.get("as");
    if (as && store.mode === "demo") store.setPersona(as);
    document.body.dataset.persona = state.me.id || "guest";
    document.body.dataset.ready = "1";
  }, [params, store, state.me.id]);

  // Remember that the user moved around inside the app, so Back can use history.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    window.sessionStorage.setItem("tpk-nav", "1");
  }, [path]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenu(false); setKeys(false); return; }
      // Desktop shortcuts: 1–4 jump between tabs (ignored while typing or with modifiers).
      const t = event.target as HTMLElement | null;
      if (!signedInRef.current || event.metaKey || event.ctrlKey || event.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
      if (event.key === "?") { event.preventDefault(); setKeys((v) => !v); return; }
      const i = ["1", "2", "3", "4"].indexOf(event.key);
      if (i >= 0) { event.preventDefault(); setKeys(false); router.push(TABS[i].href); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const [from, setFrom] = useState("sessions");
  useEffect(() => {
    setMenu(false);
    if (path.includes("/sessions/")) setFrom(window.sessionStorage.getItem("tpk-from") === "campaigns" ? "campaigns" : "sessions");
    else if (path.startsWith("/campaigns")) window.sessionStorage.setItem("tpk-from", "campaigns");
    else if (path === "/sessions" || path === "/") window.sessionStorage.setItem("tpk-from", "sessions");
  }, [path]);

  const mine = memberCampaigns(state);
  const openPolls = state.polls.filter((p) => p.status === "open" && mine.some((c) => c.id === p.cid)).length;
  const tab = path.startsWith("/campaigns/") && path.includes("/sessions/") ? from : path.startsWith("/campaigns") ? "campaigns" : path.startsWith("/polls") || path.startsWith("/p/") ? "polls" : path.startsWith("/invite") ? "invites" : path.startsWith("/account") ? "" : "sessions";
  const bare = path === "/signin" || path.startsWith("/auth/");
  const night = store.resolvedTheme === "dark";
  // Signed-out visitors on app screens get one clear way in. Invite links and public polls stay open.
  const gate = !signedIn && !!store.signedOutConfirmed && !path.startsWith("/invite/") && !path.startsWith("/p/");
  const needsName = signedIn && store.mode === "live" && !state.me.nameSet && !state.me.displayName;

  return (
    <>
      {!store.online && <div className="offline">You&apos;re offline. Showing your last-synced schedule.</div>}
      <header className={landing ? "hdr clear" : "hdr"}>
        <Brand href={signedIn ? "/sessions" : "/"} />
        {signedIn && !bare && (
          <>
            <span className="sp" />
            <nav className="dnav" aria-label="Primary">
              {TABS.map((item, i) => (
                <Link key={item.id} href={item.href} aria-keyshortcuts={String(i + 1)} title={`${item.label} (${i + 1})`} className={tab === item.id ? "on" : ""} aria-current={tab === item.id ? "page" : undefined}>
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </nav>
            <button className="acct" aria-label={`Account menu: ${state.me.displayName || state.me.email}`} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
              <Avatar name={state.me.displayName || state.me.email || "?"} id={state.me.id} />
              <Icon name="chev" className="ic ch" />
            </button>
          </>
        )}
      </header>
      {landing || bare ? children : <main>{needsName ? <NamePrompt /> : gate ? <SignInGate /> : children}</main>}
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
          <button className="scrim" aria-label="Close menu" onClick={() => setMenu(false)} />
          <div className="pop" role="menu">
            <div className="me">
              <Avatar name={state.me.displayName || state.me.email || "?"} id={state.me.id} className="" />
              <div>
                <b>{state.me.displayName || "Add your name"}</b>
                <span>{state.me.email}</span>
              </div>
            </div>
            <hr className="hair" />
            <Link className="item" href="/account" role="menuitem"><Icon name="user" />Account</Link>
            <Link className="item" href="/campaigns" role="menuitem"><Icon name="camp" />Campaigns</Link>
            <button className="item" role="menuitemcheckbox" aria-checked={night} onClick={() => store.setTheme(night ? "light" : "dark")}>
              <Icon name="moon" />Night theme<span className="tog" />
            </button>
            <hr className="hair" />
            <button className="item out" onClick={() => { setMenu(false); void store.signOut(); }}>Sign out</button>
          </div>
        </div>
      )}
      {keys && signedIn && !bare && (
        <div id="keys">
          <button className="scrim" aria-label="Close keyboard shortcuts" onClick={() => setKeys(false)} />
          <div className="pop kpop" role="dialog" aria-modal="true" aria-labelledby="keys-h">
            <h2 id="keys-h">Keyboard shortcuts</h2>
            <dl>
              {TABS.map((item, i) => (
                <div key={item.id}><dt>{item.label}</dt><dd><kbd>{i + 1}</kbd></dd></div>
              ))}
              <div><dt>Show or hide this list</dt><dd><kbd>?</kbd></dd></div>
              <div><dt>Close</dt><dd><kbd>Esc</kbd></dd></div>
            </dl>
          </div>
        </div>
      )}
      <div className="toasts" aria-live="polite">
        {shown.map(({ t, leaving }) => (
          <div key={t.id} className={`toast${t.tone === "err" ? " err" : ""}${leaving ? " out" : ""}`} aria-hidden={leaving || undefined} inert={leaving || undefined}>
            <span>{t.text}</span>
            {t.action ? (
              <button className="btn sec sm" onClick={() => { t.action?.run(); store.dismissToast(t.id); }}>{t.action.label}</button>
            ) : (
              <button className="btn sec sm" onClick={() => store.dismissToast(t.id)}>OK</button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function NamePrompt() {
  const store = useStore();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card namecard"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        await store.setDisplayName(name);
        setBusy(false);
      }}
    >
      <div className="eyebrow">Welcome to the table</div>
      <h1 className="lt">What should we call you?</h1>
      <p className="sub">Your table sees this on sessions and RSVPs. Character names are set per campaign.</p>
      <div className="fld">
        <label htmlFor="dn">Display name</label>
        <input id="dn" autoFocus required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Seth" autoComplete="nickname" />
      </div>
      <button className="btn pri" type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : "Continue"}</button>
    </form>
  );
}

function SignInGate() {
  return (
    <div className="card empty-card">
      <h1 className="lt">Sign in to see your table</h1>
      <p className="note">Sessions, campaigns, polls and invites show up after you sign in.</p>
      <Link className="btn pri" href="/signin">Sign in</Link>
    </div>
  );
}
