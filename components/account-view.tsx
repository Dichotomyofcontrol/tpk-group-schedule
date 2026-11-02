"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { BackBar, SettingRow, Switch } from "./ui";

type Named = { id: string; name: string };

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const router = useRouter();
  const titleId = useId();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<{ blocking: Named[]; deleting: Named[] } | null>(null);
  const [planError, setPlanError] = useState("");
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let live = true;
    void store.accountDeletionPlan().then((result) => {
      if (!live) return;
      if ("error" in result) setPlanError(result.error);
      else setPlan(result);
    });
    return () => {
      live = false;
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // The plan is read once when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const blocking = plan?.blocking || [];
  const deleting = plan?.deleting || [];
  const blocked = blocking.length > 0;
  const match = typed.trim() === "DELETE";
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button className="modal-scrim" type="button" aria-label="Close" onClick={onClose} />
      <form className="card sheet" onSubmit={async (event) => {
        event.preventDefault();
        if (blocked || !match) return;
        setBusy(true);
        const result = await store.deleteAccount();
        setBusy(false);
        if (!result.ok) {
          setError(result.error);
          if (result.blocking?.length) setPlan({ blocking: result.blocking, deleting });
          return;
        }
        router.push("/");
      }}>
        <h2 id={titleId}>Delete your account?</h2>
        <p>This permanently removes your sign-in, your display name, your calendar link, your votes, your roster seats, and a portrait uploaded for your email. It cannot be undone.</p>
        <p>If you are the only player in a campaign, that campaign is deleted too, including its sessions, polls, and files.</p>
        {deleting.length > 0 && <p>These campaigns will be deleted: {deleting.map((campaign) => campaign.name).join(", ")}.</p>}
        {blocked ? (
          <p>Other players are still on {blocking.map((campaign) => campaign.name).join(", ")}. Transfer the organizer role on {blocking.length === 1 ? "that campaign" : "those campaigns"} first. Nothing has been deleted.</p>
        ) : (
          <p>If you organize a campaign that still has other players, deletion stops until you transfer it. Nothing is deleted in that case.</p>
        )}
        {planError && <p className="note">{planError}</p>}
        {error && <p role="alert">{error}</p>}
        {!blocked && (
          <div className="fld">
            <label htmlFor="del-acct">Type DELETE to confirm</label>
            <input id="del-acct" autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} />
          </div>
        )}
        <div className="two end">
          <button ref={cancelRef} type="button" className="btn sec sm" onClick={onClose}>Cancel</button>
          {!blocked && <button type="submit" className="btn sm danger" disabled={!match || busy}>{busy ? "Deleting…" : "Delete my account"}</button>}
        </div>
      </form>
    </div>
  );
}

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
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="narrow">
      <BackBar href="/sessions" label="Sessions" />
      
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
        <h2 className="ph2">Sign-in</h2>
        <button className="btn ghost sm full ver" type="button" onClick={() => void store.signOut()}>Sign out</button>
        <button className="btn ghost sm full ver" type="button" onClick={() => setDeleting(true)}>Delete my account</button>
        <p className="note">Deleting removes this account. If other players are still on a campaign you organize, you transfer that campaign first. A campaign where you are the only player is deleted with the account.</p>
      </section>
      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
    </div>
  );
}
