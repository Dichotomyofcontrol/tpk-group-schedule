"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { memberCampaigns } from "@/lib/model";
import { useStore } from "@/lib/store";
import { accentInk } from "@/lib/color";

export function Shell({ children, bare = false }: { children: React.ReactNode; bare?: boolean }) {
  const store = useStore();
  const { state } = store;
  const path = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);

  useLayoutEffect(() => {
    const as = params.get("as");
    if (as && store.mode === "demo") store.setPersona(as);
    document.body.dataset.persona = state.me.id || "guest";
    document.body.dataset.ready = "1";
  }, [params, store, state.me.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "?") setHelp(true);
      if (event.key === "Escape") setHelp(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const mine = memberCampaigns(state);
  const openPolls = state.polls.filter((p) => p.status === "open" && mine.some((c) => c.id === p.cid)).length;
  const invites = state.invites.filter((i) => i.status === "pending" && (!i.email || i.email === state.me.email) && !mine.some((c) => c.id === i.cid)).length;
  const tab = path.startsWith("/campaigns") ? "campaigns" : path.startsWith("/polls") ? "polls" : path.startsWith("/invite") ? "invites" : "home";

  return (
    <>
      {!store.online && <div className="offline">You&apos;re offline. Showing your last-synced schedule.</div>}
      <header className="top">
        <Link className="logo" href="/"><i />Six in the TPK</Link>
        {store.mode === "demo" && <span className="sample">Sample table</span>}
        <span className="sp" />
        {!bare && (
          <>
            <Link className="b hide-m" href="/polls">Polls{openPolls ? ` · ${openPolls}` : ""}</Link>
            <button className="b hide-m" onClick={() => router.push("/invites")}>Subscribe to calendar</button>
          </>
        )}
        {state.me.id && (
          <button className="av" aria-label={`Account menu for ${state.me.displayName}`} onClick={() => setMenu((v) => !v)}>
            {state.me.displayName.slice(0, 1)}
          </button>
        )}
        {menu && (
          <div className="menu" role="menu">
            <div style={{ padding: "6px 10px 8px" }}>
              <b>{state.me.displayName}</b>
              <span className="hint">{state.me.email}</span>
            </div>
            {store.mode === "demo" && state.directory.map((person) => (
              <button key={person.id} onClick={() => { store.setPersona(person.id); setMenu(false); }}>
                View as {person.displayName}{person.id === state.me.id ? " · now" : ""}
              </button>
            ))}
            <button onClick={() => { store.setTheme(store.resolvedTheme === "dark" ? "light" : "dark"); setMenu(false); }}>
              {store.resolvedTheme === "dark" ? "Light mode" : "Tavern night"}
            </button>
            <button onClick={() => { setHelp(true); setMenu(false); }}>Keyboard shortcuts</button>
            <Link href="/signin" onClick={() => setMenu(false)}>Sign-in link</Link>
            {store.mode === "demo" && <button onClick={() => { store.resetDemo(); setMenu(false); }}>Reset sample table</button>}
          </div>
        )}
      </header>
      {bare ? (
        <main>{children}</main>
      ) : (
        <div className="shell">
          <aside className="left">
            {state.me.canCreateCampaigns ? (
              <Link className="b p" style={{ width: "100%" }} href="/campaigns/new">+ New campaign</Link>
            ) : (
              <p className="fine">New campaigns are limited to the organizer list. Ask Seth for an invite.</p>
            )}
            <h6>Show campaigns</h6>
            <div>
              {mine.map((c) => {
                const on = !state.hiddenCids.includes(c.id);
                return (
                  <div key={c.id} className="camp-row" style={{ ["--c" as string]: c.color, ["--accent" as string]: accentInk(c.color) }}>
                    <input
                      type="checkbox"
                      checked={on}
                      aria-label={`Show ${c.name}`}
                      onChange={() => store.toggleHidden(c.id)}
                    />
                    <Link href={`/campaigns/${c.id}`} style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                      <span className="sw" />
                      <span className="name">{c.name}</span>
                    </Link>
                  </div>
                );
              })}
            </div>
            <h6>Calendar</h6>
            <Link className="b" style={{ width: "100%" }} href="/invites">Subscribe (webcal)</Link>
            <p className="fine">Only play dates go to your calendar, for the campaigns you have switched on.</p>
            <h6>Invites</h6>
            <div>
              {state.invites.filter((i) => i.status === "pending" && (!i.email || i.email === state.me.email)).map((invite) => {
                const campaign = state.campaigns.find((c) => c.id === invite.cid);
                if (!campaign || mine.some((c) => c.id === campaign.id)) return null;
                return (
                  <Link key={invite.token} href={`/invite/${invite.token}`} className="camp-row" style={{ ["--c" as string]: "#9aa1a9" }}>
                    <span className="sw" />
                    <span className="name">{campaign.name}</span>
                    <span className="n">Accept</span>
                  </Link>
                );
              })}
              {invites === 0 && <p className="fine">No open invites.</p>}
            </div>
          </aside>
          <div className="main">{children}</div>
        </div>
      )}
      <nav className="tabbar" aria-label="Primary">
        <Link href="/" className={tab === "home" ? "on" : ""}><span aria-hidden>🎲</span>Play dates</Link>
        <Link href="/campaigns" className={tab === "campaigns" ? "on" : ""}><span aria-hidden>🛡</span>Campaigns</Link>
        <Link href="/polls" className={tab === "polls" ? "on" : ""}><span aria-hidden>🗳</span>Polls</Link>
        <Link href="/invites" className={tab === "invites" ? "on" : ""}><span aria-hidden>✉</span>Invites</Link>
      </nav>
      {help && (
        <div className="toasts" style={{ bottom: "auto", top: 72 }}>
          <div className="card help" role="dialog" aria-label="Keyboard shortcuts">
            <b>Shortcuts</b>
            <p><kbd>j</kbd> <kbd>k</kbd> move through play dates</p>
            <p><kbd>c</kbd> can&apos;t make it, or come back</p>
            <p><kbd>y</kbd> <kbd>n</kbd> <kbd>m</kbd> when a session asks for RSVPs</p>
            <p><kbd>?</kbd> this card · <kbd>esc</kbd> close</p>
            <button className="b" onClick={() => setHelp(false)}>Close</button>
          </div>
        </div>
      )}
      <div className="toasts" aria-live="polite">
        {store.toasts.map((t) => (
          <div key={t.id} className={`toast${t.tone === "err" ? " err" : ""}`}>
            <span>{t.text}</span>
            <button className="b" onClick={() => store.dismissToast(t.id)}>OK</button>
          </div>
        ))}
      </div>
      </>
  );
}
